from rest_framework import viewsets, decorators, response, permissions, status
from rest_framework.exceptions import PermissionDenied
from .models import Campus
from .serializers import CampusSerializer


class CampusViewSet(viewsets.ModelViewSet):
    queryset = Campus.objects.all()
    serializer_class = CampusSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _get_org(self):
        """Return org object or None. Works for both DB users and stateless _TokenUser."""
        from users.middleware import get_current_organization
        org = getattr(self.request.user, 'organization', None) or get_current_organization()
        return org

    def get_queryset(self):
        user = self.request.user
        queryset = Campus.objects.all()

        if user.is_superadmin():
            return queryset

        org = self._get_org()
        if org:
            if user.role in ['superadmin', 'admin', 'org_admin', 'principal', 'coordinator']:
                return queryset
            campus_id = getattr(user, 'campus_id', None) or getattr(getattr(user, 'campus', None), 'id', None)
            if campus_id:
                return queryset.filter(id=campus_id)
            return queryset

        # No org context — restrict to assigned campus if available
        campus_id = getattr(user, 'campus_id', None) or getattr(getattr(user, 'campus', None), 'id', None)
        if campus_id:
            return queryset.filter(id=campus_id)

        return queryset.none()

    def perform_create(self, serializer):
        """Auto-assign organization and enforce campus quota from plan."""
        user = self.request.user

        if not user.is_superadmin():
            org = self._get_org()
            if not org:
                raise PermissionDenied("You are not associated with any organization.")

            current_count = Campus.objects.filter(organization=org).count()
            if current_count >= org.max_campuses:
                raise PermissionDenied(
                    f"Campus quota exceeded. Your plan allows a maximum of "
                    f"{org.max_campuses} campus(es). You already have {current_count}. "
                    f"Please upgrade your subscription to add more campuses."
                )

            serializer.save(organization=org)
        else:
            serializer.save()

    # ✅ Custom endpoint: campus summary
    @decorators.action(detail=True, methods=["get"])
    def summary(self, request, pk=None):
        campus = self.get_object()
        data = {
            "campus_name": campus.campus_name,
            "campus_code": campus.campus_code,
            "campus_type": campus.campus_type,
            "city": campus.city,
            "student_capacity": campus.student_capacity,
            "status": campus.status,
        }
        return response.Response(data)

    # ✅ Custom endpoint: facilities list
    @decorators.action(detail=True, methods=["get"])
    def facilities(self, request, pk=None):
        campus = self.get_object()
        data = {
            "power_backup": campus.power_backup,
            "internet_available": campus.internet_available,
            "canteen_facility": campus.canteen_facility,
            "library_available": campus.library_available,
            "teacher_transport": campus.teacher_transport,
            "student_transport": campus.student_transport,
            "meal_program": campus.meal_program,
            "sports_available": campus.sports_available,
            "num_computer_labs": campus.num_computer_labs,
            "num_science_labs": campus.num_science_labs,
            "num_biology_labs": campus.num_biology_labs,
            "num_chemistry_labs": campus.num_chemistry_labs,
            "num_physics_labs": campus.num_physics_labs,
            "washrooms": {
                "male_teachers": campus.male_teachers_washrooms,
                "female_teachers": campus.female_teachers_washrooms,
                "male_students": campus.male_student_washrooms,
                "female_students": campus.female_student_washrooms,
                "total": campus.total_washrooms,
            }
        }
        return response.Response(data)

    # ✅ Custom endpoint: only active campuses
    @decorators.action(detail=False, methods=["get"])
    def active(self, request):
        campuses = Campus.objects.filter(status="active")
        serializer = self.get_serializer(campuses, many=True)
        return response.Response(serializer.data)