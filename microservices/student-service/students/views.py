# views.py
import os
import tempfile
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.views import APIView
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend
from users.permissions import IsSuperAdminOrPrincipal, IsTeacherOrAbove
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Count, Q
from .models import Student
from .serializers import StudentSerializer
from .filters import StudentFilter
from teachers.models import Teacher

from rest_framework.decorators import api_view, permission_classes
from users.permissions import IsStudent

@api_view(['PATCH'])
@permission_classes([IsAuthenticated, IsStudent])
def student_upload_photo(request):
    """
    Student can upload/update their own profile photo.
    """
    from django.db.models.query import QuerySet
    try:
        student = (
            QuerySet(Student)
            .get(student_id=request.user.username, is_deleted=False)
        )
        photo = request.FILES.get('photo')
        if not photo:
            return Response({'error': 'No photo provided'}, status=status.HTTP_400_BAD_REQUEST)
        student.photo = photo
        student.save(update_fields=['photo'])
        photo_url = request.build_absolute_uri(student.photo.url) if student.photo else None
        return Response({'photo': photo_url})
    except Student.DoesNotExist:
        return Response({'error': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsStudent])
def student_my_profile(request):
    """
    Student can view their own profile.
    Uses raw QuerySet to bypass OrganizationManager filtering.
    """
    from django.db.models.query import QuerySet
    try:
        # Bypass OrganizationManager — student can only see their own record
        student = (
            QuerySet(Student)
            .select_related('campus', 'classroom', 'classroom__grade')
            .get(student_id=request.user.username, is_deleted=False)
        )
        serializer = StudentSerializer(student, context={'request': request})
        return Response(serializer.data)
    except Student.DoesNotExist:
        return Response({'error': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)


class StudentPagination(PageNumberPagination):
    """Custom pagination for students - default 25 per page"""
    page_size = 25
    page_size_query_param = 'page_size'
    max_page_size = 100

class StudentViewSet(viewsets.ModelViewSet):
    queryset = Student.objects.all()
    serializer_class = StudentSerializer
    permission_classes = [IsAuthenticated, (IsTeacherOrAbove | IsStudent)]
    pagination_class = StudentPagination
    
    # Filtering, search, and ordering
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = StudentFilter
    search_fields = ['name', 'student_code', 'gr_no', 'father_name', 'student_id']
    ordering_fields = ['name', 'created_at', 'enrollment_year', 'student_code']
    ordering = ['-created_at']  # Default ordering
    
    def get_queryset(self):
        """Override to handle role-based filtering for list views and stats actions"""
        queryset = Student.objects.all().filter(is_deleted=False).select_related('campus', 'classroom')
        
        # Default filtering for list action: Hide Alumni and Unassigned students
        # unless specifically requested via filters. This ensures the main list 
        # only shows students currently enrolled and assigned to classes.
        if self.action == 'list':
            query_params = self.request.query_params
            # If no explicit filters for special categories are provided, apply defaults
            has_special_filter = any(param in query_params for param in [
                'classroom', 'classroom__isnull', 'current_grade', 'is_active', 
                'shift', 'section', 'level', 'search'
            ])
            
            if not has_special_filter:
                queryset = queryset.filter(is_active=True, classroom__isnull=False).exclude(current_grade__iexact='Alumni')
        
        if self.action in [
            'list',
            'gender_stats',
            'campus_stats',
            'grade_distribution',
            'enrollment_trend',
            'mother_tongue_distribution',
            'religion_distribution',
            'age_distribution',
            'total',
        ]:
            user = self.request.user
            
            if user.is_superadmin():
                return queryset
                
            if user.role == 'admin':
                # Partner Admin: Filter by organizations they created
                return queryset.filter(organization__created_by=user)

            if user.role == 'org_admin':
                # Org Admin: Filter by organization
                if user.organization:
                    return queryset.filter(organization=user.organization)
                return queryset.none()

            if user.is_principal():
                campus = None
                if hasattr(user, 'campus') and user.campus:
                    campus = user.campus
                else:
                    # Fallback to Principal profile if User campus is missing
                    try:
                        from principals.models import Principal
                        principal_obj = Principal.objects.get(employee_code=user.username)
                        campus = principal_obj.campus
                    except Principal.DoesNotExist:
                        pass
                
                if campus:
                    queryset = queryset.filter(campus=campus)
                elif user.organization:
                    # If no specific campus is assigned, allow viewing all students in the organization
                    queryset = queryset.filter(organization=user.organization)
                else:
                    # If no campus and no organization, show nothing
                    queryset = queryset.none()
            elif user.is_teacher():
                try:
                    teacher_obj = Teacher.objects.get(employee_code=user.username)
                    
                    assigned_classrooms = []
                    
                    if teacher_obj.assigned_classroom:
                        assigned_classrooms.append(teacher_obj.assigned_classroom)
                    
                    # Add classrooms assigned via ForeignKey on ClassRoom
                    assigned_classrooms.extend(list(teacher_obj.classroom_set.all()))
                    
                    # Add multiple classroom assignments (ManyToMany)
                    assigned_classrooms.extend(list(teacher_obj.assigned_classrooms.all()))
                    
                    # Remove duplicates and None values
                    assigned_classrooms = list(set([c for c in assigned_classrooms if c]))
                    
                    if assigned_classrooms:
                        # Filter students by any of the assigned classrooms
                        queryset = queryset.filter(classroom__in=assigned_classrooms)
                    else:
                        # If no classroom assigned, show no students
                        queryset = queryset.none()
                except Teacher.DoesNotExist:
                    # If teacher object doesn't exist, show no students
                    queryset = queryset.none()
            elif user.is_coordinator():
                # Coordinator: Show students from classrooms under their assigned level
                from coordinator.models import Coordinator
                try:
                    coordinator_obj = Coordinator.get_for_user(user)
                    if not coordinator_obj:
                        queryset = queryset.none()
                    else:
                        # Determine which levels this coordinator manages (single level or multiple assigned_levels)
                        managed_levels = []
                        if coordinator_obj.shift == 'both' and coordinator_obj.assigned_levels.exists():
                            managed_levels = list(coordinator_obj.assigned_levels.all())
                        elif coordinator_obj.level:
                            managed_levels = [coordinator_obj.level]

                        # If no managed levels, return empty queryset
                        if not managed_levels:
                            queryset = queryset.none()
                        else:
                            # Get all classrooms under these managed levels and the coordinator's campus
                            from classes.models import ClassRoom
                            coordinator_classrooms = ClassRoom.objects.filter(
                                grade__level__in=managed_levels,
                                grade__level__campus=coordinator_obj.campus
                            ).values_list('id', flat=True)

                            # Filter students from these classrooms
                            queryset = queryset.filter(classroom__in=coordinator_classrooms)
                except Exception:
                    # If coordinator resolution fails, return empty queryset
                    queryset = queryset.none()
            
            elif user.role == 'student':
                # Student: Can only see their own record
                queryset = queryset.filter(student_id=user.username)
            
            # Shift filtering is now handled by StudentFilter class
            # No need for manual shift filtering here
        
        return queryset

    def get_object(self):
        """Override to handle individual student retrieval with proper permissions"""
        # For destroy action, we need to get the object even if it's soft deleted
        # So we use with_deleted() to bypass the manager's default filter
        if self.action == 'destroy':
            # Get object using with_deleted() to allow deleting already soft-deleted items if needed
            lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
            lookup_value = self.kwargs[lookup_url_kwarg]
            filter_kwargs = {self.lookup_field: lookup_value}
            obj = Student.objects.with_deleted().get(**filter_kwargs)
        else:
            # For other actions, use normal queryset (excludes deleted)
            obj = super().get_object()
        
        # Apply role-based access control for individual objects
        user = self.request.user
        
        if user.is_teacher():
            # Teacher: Check if student is in their assigned classrooms
            from teachers.models import Teacher
            try:
                teacher_obj = Teacher.objects.get(employee_code=user.username)
                
                # Get all assigned classrooms (both legacy single assignment and new multiple assignments)
                assigned_classrooms = []
                
                # Add legacy single classroom assignment
                if teacher_obj.assigned_classroom:
                    assigned_classrooms.append(teacher_obj.assigned_classroom)
                
                # Add classrooms assigned via ForeignKey on ClassRoom
                assigned_classrooms.extend(list(teacher_obj.classroom_set.all()))

                # Add multiple classroom assignments (ManyToMany)
                assigned_classrooms.extend(list(teacher_obj.assigned_classrooms.all()))
                
                # Remove duplicates and None values
                assigned_classrooms = list(set([c for c in assigned_classrooms if c]))
                
                if assigned_classrooms and obj.classroom not in assigned_classrooms:
                    # Student is not in teacher's assigned classrooms
                    from rest_framework.exceptions import PermissionDenied
                    raise PermissionDenied("You don't have permission to view this student.")
                    
            except Teacher.DoesNotExist:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Teacher profile not found.")

        elif user.role == 'org_admin':
            # Org Admin: Check if student belongs to their organization
            if not user.organization or obj.organization != user.organization:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You don't have permission to view this student.")
                
        elif user.is_principal():
            # Principal: Check if student is from their campus or organization
            campus = getattr(user, 'campus', None)
            if campus:
                if obj.campus != campus:
                    from rest_framework.exceptions import PermissionDenied
                    raise PermissionDenied("You don't have permission to view this student.")
            elif user.organization:
                if obj.organization != user.organization:
                    from rest_framework.exceptions import PermissionDenied
                    raise PermissionDenied("You don't have permission to view this student.")
            else:
                # No campus and no organization
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You don't have permission to view this student.")
                
        elif user.is_coordinator():
            # Coordinator: Check if student is from their assigned level
            from coordinator.models import Coordinator
            try:
                coordinator_obj = Coordinator.get_for_user(user)
                if not coordinator_obj:
                    from rest_framework.exceptions import PermissionDenied
                    raise PermissionDenied("Coordinator profile not found.")

                # Build managed levels similar to get_queryset
                managed_levels = []
                if coordinator_obj.shift == 'both' and coordinator_obj.assigned_levels.exists():
                    managed_levels = list(coordinator_obj.assigned_levels.all())
                elif coordinator_obj.level:
                    managed_levels = [coordinator_obj.level]

                # If student has a classroom, ensure its grade's level is among managed levels
                if obj.classroom:
                    student_level = obj.classroom.grade.level
                    if not managed_levels or student_level not in managed_levels:
                        from rest_framework.exceptions import PermissionDenied
                        raise PermissionDenied("You don't have permission to view this student.")
            except PermissionDenied:
                raise
            except Exception:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Coordinator profile not found.")
        elif user.role == 'student':
            # Student: Can only view their own profile
            if obj.student_id != user.username:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You don't have permission to view this student.")
        
        return obj
    
    def perform_create(self, serializer):
        """Set actor and organization before creating student, with quota enforcement."""
        from rest_framework.exceptions import PermissionDenied

        user = self.request.user

        save_kwargs = {}
        if not user.is_superadmin() and user.organization:
            org = user.organization

            # ── Student Quota Enforcement ──────────────────────────────────
            current_count = Student.objects.filter(organization=org).count()
            if current_count >= org.max_students:
                raise PermissionDenied(
                    f"Student quota exceeded. Your plan allows a maximum of "
                    f"{org.max_students} student(s). You currently have {current_count}. "
                    f"Please upgrade your subscription to enroll more students."
                )
            # ──────────────────────────────────────────────────────────────

            save_kwargs['organization'] = org
        
        # Explicitly set is_draft to False for new admissions via form
        save_kwargs['is_draft'] = False

        instance = serializer.save(**save_kwargs)
        instance._actor = user
        instance.save()
        self._ensure_student_user_account(instance)

    def _ensure_student_user_account(self, student):
        """
        Auto-create a User account for the student if one does not exist yet.
        Username = student_id, default password = '12345'.
        Only runs when student_id is set (i.e., student is not a draft without an ID).
        """
        if not student.student_id:
            return
        
        from users.models import User
        
        # Determine the email to use: priority to student.email, fallback to placeholder
        actual_email = student.email if student.email else f"{student.student_id}@student.portal"
        
        user_obj = User.objects.filter(username=student.student_id).first()
        
        if user_obj:
            # If user exists, sync email if it changed or was placeholder and student now has one
            if student.email and user_obj.email != student.email:
                user_obj.email = student.email
                user_obj.save()
            return

        # Check if email is already taken by another user
        if User.objects.filter(email__iexact=actual_email).exists():
            # If the placeholder email is taken, we might have a collision, but for now we skip
            return
            
        try:
            u = User(
                username=student.student_id,
                email=actual_email,
                role='student',
                organization=student.organization,
                campus=student.campus,
                has_changed_default_password=False,
                is_verified=True,
            )
            u.set_password('12345')
            u.save()
            print(f"[STUDENT USER] Created user account for {student.student_id} with email {actual_email}")
        except Exception as e:
            print(f"[STUDENT USER] Could not create user account for {student.student_id}: {e}")

    def perform_update(self, serializer):
        """Set actor before updating student"""
        instance = serializer.save()
        instance._actor = self.request.user
        # Save again to trigger signals with actor
        instance.save()
        self._ensure_student_user_account(instance)
    
    def destroy(self, request, *args, **kwargs):
        """Override destroy to ensure soft delete is used - NEVER calls default delete"""
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"[DESTROY] destroy() method called for DELETE request")
        
        # Get the instance
        instance = self.get_object()
        student_id = instance.id
        student_name = instance.name
        
        logger.info(f"[DESTROY] Got student instance: ID={student_id}, Name={student_name}, is_deleted={instance.is_deleted}")
        
        # Check if already deleted
        if instance.is_deleted:
            logger.warning(f"[DESTROY] Student {student_id} is already soft deleted")
            from rest_framework.exceptions import NotFound
            raise NotFound("Student is already deleted.")
        
        # IMPORTANT: Call perform_destroy which does soft delete
        # DO NOT call super().destroy() as it would do hard delete
        logger.info(f"[DESTROY] Calling perform_destroy() for soft delete")
        self.perform_destroy(instance)
        
        # Verify the student still exists in database (soft deleted, not hard deleted)
        try:
            from .models import Student
            # Use with_deleted() to check if student exists (even if soft deleted)
            still_exists = Student.objects.with_deleted().filter(pk=student_id).exists()
            if not still_exists:
                logger.error(f"[DESTROY] CRITICAL: Student {student_id} was HARD DELETED! This should not happen!")
                raise Exception(f"CRITICAL ERROR: Student {student_id} was permanently deleted instead of soft deleted!")
            else:
                # Check if it's soft deleted
                student_check = Student.objects.with_deleted().get(pk=student_id)
                if student_check.is_deleted:
                    logger.info(f"[DESTROY] SUCCESS: Student {student_id} is soft deleted (is_deleted=True)")
                else:
                    logger.error(f"[DESTROY] ERROR: Student {student_id} exists but is_deleted is False!")
        except Student.DoesNotExist:
            logger.error(f"[DESTROY] CRITICAL: Student {student_id} does not exist in database - was HARD DELETED!")
            raise Exception(f"CRITICAL ERROR: Student {student_id} was permanently deleted!")
        
        logger.info(f"[DESTROY] destroy() completed successfully")
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    def perform_destroy(self, instance):
        """Soft delete student and create audit log"""
        # IMPORTANT: Do NOT call super().perform_destroy() as it would do hard delete
        # Store student info BEFORE soft delete (in case instance gets modified)
        student_id = instance.id
        student_name = instance.name
        student_campus = instance.campus
        
        # Get user name for audit log
        user = self.request.user
        user_name = user.get_full_name() if hasattr(user, 'get_full_name') else (user.username or 'Unknown')
        user_role = user.get_role_display() if hasattr(user, 'get_role_display') else (user.role or 'User')
        
        # Set actor for potential signal use (though soft_delete uses update() which bypasses signals)
        instance._actor = user
        
        # Log before soft delete
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"[SOFT_DELETE] Starting soft delete for student ID: {student_id}, Name: {student_name}")
        logger.info(f"[SOFT_DELETE] Student is_deleted before: {instance.is_deleted}")
        
        # Soft delete the student (instead of hard delete)
        # This uses update() to directly modify database, does NOT call .delete()
        # This ensures no post_delete signal is triggered
        try:
            instance.soft_delete()
            logger.info(f"[SOFT_DELETE] soft_delete() method called successfully")
            
            # Verify soft delete worked
            instance.refresh_from_db()
            logger.info(f"[SOFT_DELETE] Student is_deleted after refresh: {instance.is_deleted}")
            
            if not instance.is_deleted:
                logger.error(f"[SOFT_DELETE] CRITICAL ERROR: Soft delete failed! Student {student_id} is_deleted is still False!")
                raise Exception(f"Soft delete failed for student {student_id} - is_deleted is still False after soft_delete() call")
            
            logger.info(f"[SOFT_DELETE] Soft delete successful for student {student_id}")
        except Exception as e:
            logger.error(f"[SOFT_DELETE] ERROR during soft_delete(): {str(e)}")
            raise
        
        # Create audit log after soft deletion
        try:
            from attendance.models import AuditLog
            AuditLog.objects.create(
                feature='student',
                action='delete',
                entity_type='Student',
                entity_id=student_id,
                user=user,
                ip_address=self.request.META.get('REMOTE_ADDR'),
                changes={'name': student_name, 'student_id': student_id, 'campus_id': student_campus.id if student_campus else None},
                reason=f'Student {student_name} deleted by {user_role} {user_name}'
            )
        except Exception as e:
            # Log error but don't fail the deletion
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to create audit log for student deletion: {str(e)}")


    
    @action(detail=False, methods=["get"], url_path='enrollment_trend')
    def enrollment_trend(self, request):
        """
        Get enrollment trend by year.

        Uses filter_queryset(self.get_queryset()) so that:
        - Role-based scoping from get_queryset is applied (principal, teacher, coordinator, etc.)
        - Query params (campus, enrollment_year, gender, shift, etc.) from StudentFilter
          are respected – this is critical for the superadmin dashboard campus filter.
        """
        from django.db.models import Count, Value
        from django.db.models.functions import Coalesce

        queryset = self.filter_queryset(self.get_queryset())

        # Normalize NULL enrollment_year to 2025 BEFORE grouping
        trend_data = queryset.annotate(
            normalized_year=Coalesce('enrollment_year', Value(2025))
        ).values('normalized_year').annotate(
            count=Count('id')
        ).order_by('normalized_year')

        data = [
            {"year": str(item['normalized_year']), "count": item['count']}
            for item in trend_data
        ]

        # Limit to last 6 years
        if len(data) > 6:
            data = data[-6:]

        return Response(data)
    

    
    @action(detail=False, methods=['get'], url_path='total')
    def total_students(self, request):
        """Get total student count"""
        queryset = self.filter_queryset(self.get_queryset())
        total = queryset.count()
        return Response({'totalStudents': total})
    
    @action(detail=False, methods=['post'], url_path='check_duplicate')
    def check_duplicate(self, request):
        """Check if CNIC or Email already exists for an active student within the organization."""
        cnic = request.data.get('student_cnic')
        email = request.data.get('email')
        
        user = request.user
        # For superadmin, they might check across all, or specify org. Assuming org scoping:
        org = getattr(user, 'organization', None)

        # Base queryset for active students
        queryset = Student.objects.filter(is_deleted=False)
        if org:
            queryset = queryset.filter(organization=org)

        response_data = {'cnic_exists': False, 'email_exists': False}

        if cnic:
            if queryset.filter(student_cnic=cnic).exists():
                response_data['cnic_exists'] = True
        
        if email:
            if queryset.filter(email__iexact=email).exists():
                response_data['email_exists'] = True

        return Response(response_data)
    
    @action(detail=False, methods=['get'], url_path='gender_stats')
    def gender_stats(self, request):
        """Get gender distribution stats"""
        queryset = self.filter_queryset(self.get_queryset())
        
        stats = queryset.aggregate(
            male=Count('id', filter=Q(gender='male')),
            female=Count('id', filter=Q(gender='female')),
            other=Count('id', filter=Q(gender__isnull=True) | Q(gender='other'))
        )
        
        return Response(stats)
    
    @action(detail=False, methods=['get'], url_path='campus_stats')
    def campus_stats(self, request):
        """Get campus-wise student distribution"""
        queryset = self.filter_queryset(self.get_queryset())
        
        campus_data = queryset.values('campus__campus_name').annotate(
            count=Count('id')
        ).order_by('-count')
        
        data = []
        for item in campus_data:
            campus_name = item['campus__campus_name'] or 'Unknown Campus'
            data.append({
                'campus': campus_name,
                'count': item['count']
            })
        
        return Response(data)
    
    @action(detail=False, methods=['get'], url_path='grade_distribution')
    def grade_distribution(self, request):
        """
        Get grade-wise student distribution with NORMALIZED grade labels.

        Problems we solve here:
        - Raw data can contain mixed formats like "Grade 1", "Grade I", "Grade-1",
          "KG-1", "KG-I", "KG1", etc.
        - Dashboard filters should show clean, canonical labels:
          "Nursery", "KG-I", "KG-II", "Grade 1" .. "Grade 10", "Special Class".

        We aggregate counts by a normalized label so that:
        - Filters look clean
        - Selecting "Grade 1" in the frontend still works (StudentFilter.current_grade
          already accepts both roman and numeric variations).
        """
        queryset = self.filter_queryset(self.get_queryset())

        grade_rows = queryset.values('current_grade').annotate(
            count=Count('id')
        ).order_by('current_grade')

        def normalize_grade_label(raw: str) -> str:
            if not raw:
                return "Unknown Grade"

            value = (raw or "").strip()
            lower = value.lower()

            # Direct mappings for pre-primary / special
            if 'nursery' in lower:
                return 'Nursery'
            if 'special' in lower:
                return 'Special Class'

            # Roman ↔ number helpers
            roman_to_num = {
                'i': '1', 'ii': '2', 'iii': '3', 'iv': '4', 'v': '5',
                'vi': '6', 'vii': '7', 'viii': '8', 'ix': '9', 'x': '10',
            }
            num_to_roman = {v: k.upper() for k, v in roman_to_num.items()}

            import re

            # KG grades
            if 'kg' in lower:
                match = re.search(r'kg[-_\s]?([ivx\d]+)', lower)
                if match:
                    token = match.group(1)
                    # token can be roman or number
                    if token in roman_to_num:
                        num = roman_to_num[token]
                    else:
                        num = token
                    # Canonical: KG-I, KG-II
                    if num in num_to_roman:
                        roman = num_to_roman[num]
                        return f"KG-{roman}"
                    return f"KG-{num}"
                return "KG-I"

            # Regular grades
            if 'grade' in lower:
                match = re.search(r'grade[-_\s]*([ivx\d]+)', lower)
                if match:
                    token = match.group(1)
                    if token in roman_to_num:
                        num = roman_to_num[token]
                    else:
                        num = token
                    # Canonical: Grade 1 .. Grade 10
                    return f"Grade {num}"
                # Fallback: just "Grade"
                return "Grade"

            # Fallback: keep original capitalization but trim
            return value

        # Aggregate counts per normalized label
        aggregated: dict[str, int] = {}
        for row in grade_rows:
            raw_grade = row['current_grade']
            count = row['count'] or 0
            label = normalize_grade_label(raw_grade)
            aggregated[label] = aggregated.get(label, 0) + count

        # Helper to sort grades logically
        def get_grade_order(label: str) -> int:
            s = label.lower()
            if 'nursery' in s: return 1
            if 'kg-i' in s or 'kg i' in s: return 2
            if 'kg-ii' in s or 'kg ii' in s: return 3
            if 'grade' in s:
                import re
                match = re.search(r'(\d+)', s)
                if match:
                    return 10 + int(match.group(1))
            if 'special' in s: return 50
            return 100

        # Build response sorted logically
        data = [
            {"grade": label, "count": count}
            for label, count in sorted(aggregated.items(), key=lambda x: get_grade_order(x[0]))
        ]

        return Response(data)
    
    
    @action(detail=True, methods=['get'], url_path='results')
    def get_student_results(self, request, pk=None):
        """Get all results for a specific student"""
        student = self.get_object()
        from result.models import Result
        
        results = Result.objects.filter(student=student).order_by('-created_at')
        results_data = []
        
        for result in results:
            result_data = {
                'id': result.id,
                'exam_type': result.exam_type,
                'academic_year': result.academic_year,
                'semester': result.semester,
                'status': result.status,
                'total_marks': result.total_marks,
                'obtained_marks': result.obtained_marks,
                'percentage': result.percentage,
                'grade': result.grade,
                'result_status': result.result_status,
                'created_at': result.created_at,
                'subject_marks': []
            }
            
            # Add subject marks
            for subject_mark in result.subject_marks.all():
                result_data['subject_marks'].append({
                    'subject_name': subject_mark.subject_name,
                    'total_marks': subject_mark.total_marks,
                    'obtained_marks': subject_mark.obtained_marks,
                    'has_practical': subject_mark.has_practical,
                    'practical_total': subject_mark.practical_total,
                    'practical_obtained': subject_mark.practical_obtained,
                    'is_pass': subject_mark.is_pass
                })
            
            results_data.append(result_data)
        
        return Response(results_data)
    
    @action(detail=True, methods=['get'], url_path='attendance')
    def get_student_attendance(self, request, pk=None):
        """Get all attendance records for a specific student"""
        student = self.get_object()
        from attendance.models import StudentAttendance
        
        attendance_records = StudentAttendance.objects.filter(
            student=student
        ).select_related('attendance').order_by('-attendance__date')
        
        attendance_data = []
        for record in attendance_records:
            attendance_data.append({
                'id': record.id,
                'status': record.status,
                'remarks': record.remarks,
                'date': record.attendance.date,
                'created_at': record.created_at,
                'attendance': {
                    'id': record.attendance.id,
                    'date': record.attendance.date,
                    'classroom': record.attendance.classroom.name if record.attendance.classroom else None
                }
            })
        
        return Response(attendance_data)
    
    @action(detail=False, methods=['get'], url_path='mother_tongue_distribution')
    def mother_tongue_distribution(self, request):
        """Get mother tongue distribution"""
        queryset = self.filter_queryset(self.get_queryset())
        
        tongue_data = queryset.values('mother_tongue').annotate(
            count=Count('id')
        ).order_by('-count')
        
        data = []
        for item in tongue_data:
            t_raw = item['mother_tongue']
            tongue = (t_raw or "").strip().title() or 'Unknown'
            data.append({
                'name': tongue,
                'value': item['count']
            })
        
        return Response(data)
    
    @action(detail=False, methods=['get'], url_path='religion_distribution')
    def religion_distribution(self, request):
        """Get religion distribution"""
        queryset = self.filter_queryset(self.get_queryset())
        
        religion_data = queryset.values('religion').annotate(
            count=Count('id')
        ).order_by('-count')
        
        islam_variants = {
            'islam', 
            'brohi', 'pashto', 'pashhto', 'sindhi', 'saraiki', 
            'balochi', 'punjabi', 'urdu', 'kohistani', 'masood',
            '', 'none'
        }
        
        aggregated = {}
        
        for item in religion_data:
            r_raw = item['religion']
            count = item['count']
            
            # clean and lower case for comparison
            r_clean = (r_raw or "").strip().lower()
            
            # Determine canonical name
            if r_clean in islam_variants:
                canonical = 'Islam'
            elif r_clean in ['non muslim', 'non-muslim']:
                canonical = 'Non Muslim'
            elif r_clean == 'christianity':
                canonical = 'Christianity'
            elif r_clean == 'hinduism':
                canonical = 'Hinduism'
            else:
                # Default to title case for others
                canonical = (r_raw or "Unknown").strip().title()
            
            # Add to aggregation
            aggregated[canonical] = aggregated.get(canonical, 0) + count
            
        # Build final response list with < 10 logic
        final_data = []
        non_muslim_accumulated = aggregated.get('Non Muslim', 0)
        
        # Remove Non Muslim from dict to process it last
        if 'Non Muslim' in aggregated:
            del aggregated['Non Muslim']
            
        for name, count in aggregated.items():
            # Islam is always its own category
            if name == 'Islam':
                final_data.append({'name': name, 'value': count})
            # Check for small groups
            elif count < 10:
                non_muslim_accumulated += count
            else:
                final_data.append({'name': name, 'value': count})
                
        # Add Non Muslim category if it has any count
        if non_muslim_accumulated > 0:
            final_data.append({'name': 'Non Muslim', 'value': non_muslim_accumulated})
            
        return Response(final_data)
    
    @action(detail=False, methods=['get'], url_path='age_distribution')
    def age_distribution(self, request):
        """Get age distribution split by gender (Male/Female) for population pyramid"""
        queryset = self.filter_queryset(self.get_queryset())
        
        # Fetch data needed for calculation
        students_data = queryset.values('dob', 'current_grade', 'gender')
        
        age_counts = {}
        current_year = 2025
        
        import re
        
        # Helper to infer age from grade string
        def get_age_from_grade(grade_str):
            if not grade_str:
                return 0
            
            s = grade_str.lower().strip()
            
            # Direct text mappings
            if 'nursery' in s: return 4
            if 'prep' in s: return 5
            if 'hmz' in s: return 12  # Hifz usually older
            
            # KG check
            if 'kg' in s:
                if '2' in s or 'ii' in s: return 6
                return 5
                
            # Number extraction for classes 1-10
            # Matches "Grade 5", "Class 5", "5th", just "5", "V", etc.
            
            # Roman numerals simple check
            roman_map = {'x': 10, 'ix': 9, 'viii': 8, 'vii': 7, 'vi': 6, 'v': 5, 'iv': 4, 'iii': 3, 'ii': 2, 'i': 1}
            # explicit word check
            words = s.split()
            for w in words:
                # remove 'class' or 'grade' to find roman
                clean_w = w.replace('th','').replace('nd','').replace('rd','').replace('st','')
                if clean_w in roman_map:
                    return roman_map[clean_w] + 6 # Grade 1 = 7 years old
            
            # Digit extraction
            match = re.search(r'(\d+)', s)
            if match:
                grade_num = int(match.group(1))
                if 1 <= grade_num <= 12:
                    return grade_num + 6  # Grade 1 approx 7 years old
                    
            return 0

        for student in students_data:
            age = 0
            
            # 1. Try calculating from DOB
            if student['dob']:
                try:
                    birth_year = student['dob'].year
                    age = current_year - birth_year
                except:
                    age = 0
            
            # 2. If no valid age (missing or outlier), infer from Grade
            if age <= 2 or age > 25:
                # Try inferring
                inferred = get_age_from_grade(student['current_grade'])
                if inferred > 0:
                    age = inferred
            
            # 3. Aggregate if valid
            if age >= 3 and age <= 25:
                # Initialize age bucket if missing
                if age not in age_counts:
                    age_counts[age] = {'male': 0, 'female': 0}
                
                # Determine gender bucket
                g = (student.get('gender') or '').lower()
                if g == 'female':
                    age_counts[age]['female'] += 1
                else:
                   
                    if g == 'male':
                        age_counts[age]['male'] += 1
                    else:
                        if g in ['male', 'other', '']: 
                             age_counts[age]['male'] += 1

        # Format response
        data = [
            {'age': age, 'male': counts['male'], 'female': counts['female']}
            for age, counts in sorted(age_counts.items())
        ]
        
        return Response(data)
    
    @action(detail=True, methods=['post'], url_path='upload-photo')
    def upload_photo(self, request, pk=None):
        """Upload or replace a student's profile photo.

        Expects a multipart/form-data POST with a file field named 'photo'.
        Saves the file to the Student.photo ImageField and returns the photo URL.
        """
        student = self.get_object()
        photo_file = request.FILES.get('photo')
        if not photo_file:
            return Response({'detail': 'No photo file provided.'}, status=400)

        # Assign and save
        try:
            student.photo = photo_file
            student.save()
        except Exception as e:
            return Response({'detail': f'Error saving photo: {str(e)}'}, status=500)

        # Build absolute URL if possible
        try:
            photo_url = request.build_absolute_uri(student.photo.url) if student.photo else ''
        except Exception:
            photo_url = student.photo.url if student.photo else ''

        return Response({'photo_url': photo_url})

    @action(detail=True, methods=['delete'], url_path='delete-photo')
    def delete_photo(self, request, pk=None):
        """Delete a student's profile photo from storage and clear the field."""
        student = self.get_object()
        if not student.photo:
            return Response({'detail': 'No photo found to delete.'}, status=400)

        try:
            # remove file from storage
            student.photo.delete(save=False)
            # clear field and save
            student.photo = None
            student.save()
        except Exception as e:
            return Response({'detail': f'Error deleting photo: {str(e)}'}, status=500)

        return Response({'detail': 'Photo deleted'})

    @action(detail=False, methods=['post'], url_path='bulk_assign_classroom')
    def bulk_assign_classroom(self, request):
        """
        Bulk assign students to a classroom.
        Expects a POST request with:
        - student_ids (list): List of student IDs to update.
        - classroom_id (int): Target classroom ID.
        """
        student_ids = request.data.get('student_ids', [])
        classroom_id = request.data.get('classroom_id')
        
        if student_ids is None or (classroom_id is None and 'classroom_id' not in request.data):
            return Response({'error': 'Missing student_ids or classroom_id'}, status=status.HTTP_400_BAD_REQUEST)
        
        from classes.models import ClassRoom
        classroom = None
        if classroom_id and classroom_id != "none":
            try:
                classroom = ClassRoom.objects.get(id=classroom_id)
            except (ClassRoom.DoesNotExist, ValueError):
                return Response({'error': 'Classroom not found'}, status=status.HTTP_404_NOT_FOUND)
            
        students = Student.objects.filter(id__in=student_ids)
        updated_count = 0
        for student in students:
            student.classroom = classroom
            student.save()
            updated_count += 1
            
        dest_name = f"{classroom.grade.name} - {classroom.section}" if classroom else "No Classroom"
        return Response({
            'message': f'Successfully moved {updated_count} students to {dest_name}'
        })

    @action(detail=False, methods=['post'], url_path='bulk_mark_alumni')
    def bulk_mark_alumni(self, request):
        """
        Bulk mark students as Alumni.
        Removes classroom assignment, sets current_grade to 'Alumni',
        and marks the student as inactive.
        Expects: student_ids (list)
        """
        student_ids = request.data.get('student_ids', [])
        if not student_ids:
            return Response({'error': 'Missing student_ids'}, status=status.HTTP_400_BAD_REQUEST)

        students = Student.objects.filter(id__in=student_ids)
        updated_count = 0
        for student in students:
            student.classroom = None
            student.current_grade = 'Alumni'
            student.section = None
            student.is_active = False
            student.save()
            updated_count += 1

        return Response({
            'message': f'Successfully marked {updated_count} student(s) as Alumni'
        })

    @action(detail=False, methods=['get'], url_path='zakat_status')
    def zakat_status(self, request):
        """Get zakat eligibility distribution"""
        queryset = self.filter_queryset(self.get_queryset())
        
        status_data = queryset.values('zakat_status').annotate(
            count=Count('id')
        ).order_by('-count')
        
        data = []
        for item in status_data:
            s_raw = item['zakat_status']
            status_label = (s_raw or "").replace('_', ' ').title() or 'Not Specified'
            data.append({
                'name': status_label,
                'value': item['count']
            })
        
        return Response(data)

    @action(detail=False, methods=['get'], url_path='house_ownership')
    def house_ownership(self, request):
        """Get house ownership distribution"""
        queryset = self.filter_queryset(self.get_queryset())
        
        # Note: Model field is house_owned ('yes'/'no')
        ownership_data = queryset.values('house_owned').annotate(
            count=Count('id')
        ).order_by('-count')
        
        data = []
        for item in ownership_data:
            o_raw = item['house_owned']
            label = 'Owned' if o_raw == 'yes' else 'Rented' if o_raw == 'no' else 'Not Specified'
            data.append({
                'name': label,
                'value': item['count']
            })
        
        return Response(data)

    @action(detail=False, methods=['get'], url_path='form_options')
    def form_options(self, request):
        """
        Returns hardcoded lists of choices for dropdowns in frontend forms.
        This provides a single source of truth for choices across the system.
        """
        from students.models import FormOption
        from users.middleware import get_current_organization

        # Prefer org from middleware context (works for _TokenUser stateless JWT).
        # Falls back to request.user.organization for DB-backed user objects.
        org = get_current_organization()
        if org is None:
            org = getattr(request.user, 'organization', None)

        qs = FormOption.objects.filter(is_active=True)
        if org:
            qs = qs.filter(organization=org)
        else:
            qs = qs.filter(organization__isnull=True)
            
        # Optional: Seed defaults if completely empty for this org
        if not qs.exists():
            default_seeds = {
                'gender': [('male', 'Male'), ('female', 'Female')],
                'religion': [('islam', 'Islam'), ('hinduism', 'Hinduism'), ('christianity', 'Christianity'), ('other', 'Other')],
                'mother_tongue': [('brohi', 'Brohi'), ('urdu', 'Urdu'), ('sindhi', 'Sindhi'), ('balochi', 'Balochi'), ('saraiki', 'Saraiki'), ('punjabi', 'Punjabi'), ('pashhto', 'Pashhto'), ('kashmiri', 'Kashmiri'), ('bangali', 'Bangali'), ('other', 'Other')],
                'nationality': [('pakistani', 'Pakistani'), ('foreign', 'Foreign')],
                'blood_group': [('A+', 'A+'), ('A-', 'A-'), ('B+', 'B+'), ('B-', 'B-'), ('O+', 'O+'), ('O-', 'O-'), ('AB+', 'AB+'), ('AB-', 'AB-'), ('Unknown', 'Unknown')],
                'special_needs': [('none', 'None'), ('visual', 'Visual Impairment'), ('hearing', 'Hearing Impairment'), ('physical', 'Physical Disability'), ('learning', 'Learning Disability'), ('other', 'Other')],
                'emergency_relationship': [('father', 'Father'), ('mother', 'Mother'), ('guardian', 'Guardian'), ('relative', 'Other Relative')],
                'father_status': [('alive', 'Alive'), ('dead', 'Dead')],
                'mother_status': [('alive', 'Alive'), ('dead', 'Dead'), ('widowed', 'Widowed'), ('divorced', 'Divorced'), ('married', 'Married')],
                'marital_status': [('single', 'Single'), ('married', 'Married'), ('divorced', 'Divorced'), ('widowed', 'Widowed')],
                'shift': [('morning', 'Morning'), ('afternoon', 'Afternoon')],
                'section': [('A', 'A'), ('B', 'B'), ('C', 'C'), ('D', 'D'), ('E', 'E'), ('F', 'F')],
            }
            
            for cat, values in default_seeds.items():
                for v, l in values:
                    FormOption.objects.create(
                        organization=org,
                        category=cat,
                        value=v,
                        label=l
                    )
            
            qs = FormOption.objects.filter(is_active=True)
            if org:
                qs = qs.filter(organization=org)
            else:
                qs = qs.filter(organization__isnull=True)

        options = {cat[0]: [] for cat in FormOption.OPTION_CATEGORIES}
        
        for opt in qs:
            options[opt.category].append({'value': opt.value, 'label': opt.label})
        return Response(options)


class StudentBulkUploadView(APIView):
    """Upload a CSV file to create multiple students at once."""
    permission_classes = [IsAuthenticated, IsSuperAdminOrPrincipal]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        from .services.student_csv_import import import_students_from_csv

        upload = request.FILES.get('file')
        if not upload:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)

        tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.csv')
        try:
            for chunk in upload.chunks():
                tmp.write(chunk)
            tmp.flush()
            tmp.close()
            reports = import_students_from_csv(tmp.name, request.user)
            return Response({'reports': reports}, status=status.HTTP_200_OK)
        finally:
            try:
                os.unlink(tmp.name)
            except Exception:
                pass


class StudentBulkUploadTemplateView(APIView):
    """Return a CSV template for bulk student upload."""
    permission_classes = [IsAuthenticated, IsSuperAdminOrPrincipal]

    def get(self, request):
        from .services.student_csv_import import TEMPLATE_HEADERS, SAMPLE_ROW
        from django.http import HttpResponse

        # Build an Excel-friendly HTML table template
        html = ['<html><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"/></head><body>']
        html.append('<table border="1"><tr>')
        
        # Header Row
        for h in TEMPLATE_HEADERS:
            html.append(f'<th style="background-color: #f2f2f2; font-weight: bold;">{h}</th>')
        html.append('</tr>')

        # Sample Row for guidance
        html.append('<tr>')
        for h in TEMPLATE_HEADERS:
            val = SAMPLE_ROW.get(h, '')
            html.append(f'<td>{val}</td>')
        html.append('</tr>')

        # Empty row for user to start
        html.append('<tr>')
        for _ in TEMPLATE_HEADERS:
            html.append('<td></td>')
        html.append('</tr>')
        
        html.append('</table></body></html>')
        content = ''.join(html)

        response = HttpResponse(content, content_type='application/vnd.ms-excel; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="student_bulk_upload_template.xls"'
        return response

