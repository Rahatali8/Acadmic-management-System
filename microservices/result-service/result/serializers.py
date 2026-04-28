from rest_framework import serializers
from .models import Result, SubjectMark
from students.serializers import StudentSerializer
from teachers.serializers import TeacherSerializer
from coordinator.serializers import CoordinatorSerializer
from students.models import Student
from teachers.models import Teacher
from coordinator.models import Coordinator


class PrincipalResultApprovalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Result
        fields = [
            'status', 
            'principal_comments', 
            'principal_signature', 
            'approved_by_principal',
            'approved_by_principal_at',
            'principal_signed_at'
        ]

    def update(self, instance, validated_data):
        if instance.status != 'pending_principal':
            raise serializers.ValidationError(
                f"Only results pending principal approval can be approved/rejected. "
                f"Current status: {instance.status}"
            )
        
        new_status = validated_data.get('status')
        if new_status and new_status not in ['approved', 'rejected']:
            raise serializers.ValidationError(
                "Invalid status for principal approval. Must be 'approved' or 'rejected'."
            )
        
        # Update all fields provided in validated_data
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
            
        instance.save()
        return instance


class SubjectMarkSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubjectMark
        fields = '__all__'
        read_only_fields = ['is_pass', 'result', 'organization']


class SubjectMarkCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubjectMark
        fields = [
            'subject_name', 'variant', 'total_marks', 'obtained_marks',
            'has_practical', 'practical_total', 'practical_obtained', 'grade',
            'is_absent'
        ]
        read_only_fields = ['is_pass']


class ResultSerializer(serializers.ModelSerializer):
    student = StudentSerializer(read_only=True)
    teacher = TeacherSerializer(read_only=True)
    coordinator = CoordinatorSerializer(read_only=True)
    subject_marks = SubjectMarkSerializer(many=True, read_only=True)

    student_id = serializers.PrimaryKeyRelatedField(
        queryset=Student.objects.all(), source='student', write_only=True
    )
    coordinator_id = serializers.PrimaryKeyRelatedField(
        queryset=Coordinator.objects.all(), source='coordinator',
        write_only=True, required=False, allow_null=True
    )

    exam_type_display = serializers.CharField(source='get_exam_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    result_status_display = serializers.CharField(source='get_result_status_display', read_only=True)

    class Meta:
        model = Result
        fields = [
            'id', 'student', 'student_id', 'teacher', 'coordinator', 'coordinator_id',
            'exam_type', 'exam_type_display', 'month', 'academic_year', 'semester',
            'status', 'status_display', 'edit_count',
            'is_absent', 'pass_status',
            'total_marks', 'obtained_marks', 'percentage', 'grade',
            'result_status', 'result_status_display',
            'attendance_score', 'total_attendance', 'position', 'teacher_remarks',
            'coordinator_comments', 'principal_comments', 'subject_marks',
            'created_at', 'updated_at',
            'coordinator_signature', 'coordinator_signed_at',
            'principal_signature', 'principal_signed_at',
            'approved_by_coordinator', 'approved_by_coordinator_at',
            'approved_by_principal', 'approved_by_principal_at',
        ]
        read_only_fields = [
            'teacher', 'total_marks', 'obtained_marks', 'percentage', 'grade',
            'result_status', 'pass_status', 'created_at', 'updated_at', 'position',
            'coordinator_signature', 'coordinator_signed_at',
            'principal_signature', 'principal_signed_at',
            'approved_by_coordinator', 'approved_by_coordinator_at',
            'approved_by_principal', 'approved_by_principal_at',
        ]


class ResultCreateSerializer(serializers.ModelSerializer):
    subject_marks = SubjectMarkCreateSerializer(many=True, required=False)
    exclude_subjects = serializers.ListField(
        child=serializers.CharField(), write_only=True, required=False
    )

    class Meta:
        model = Result
        fields = [
            'student', 'exam_type', 'month', 'academic_year', 'semester',
            'subject_marks', 'attendance_score', 'total_attendance',
            'teacher_remarks', 'exclude_subjects', 'is_absent',
        ]

    def validate(self, data):
        student = data.get('student')
        exam_type = data.get('exam_type')

        if exam_type == 'midterm':
            if Result.objects.filter(student=student, exam_type='midterm', status='approved').exists():
                raise serializers.ValidationError(
                    "Approved Mid-term result already exists for this student."
                )
        return data

    def to_representation(self, instance):
        return ResultSerializer(instance, context=self.context).data

    def create(self, validated_data):
        subject_marks_data = validated_data.pop('subject_marks', [])
        exclude_subjects = validated_data.pop('exclude_subjects', []) or []

        user = self.context['request'].user
        try:
            teacher = Teacher.objects.get(email=user.email)
        except Teacher.DoesNotExist:
            raise serializers.ValidationError("Teacher profile not found")

        if not teacher.assigned_coordinators.exists():
            raise serializers.ValidationError("No coordinator assigned to this teacher")

        validated_data['teacher'] = teacher
        if user.organization:
            validated_data['organization'] = user.organization

        result = Result.objects.create(**validated_data)

        if not subject_marks_data:
            try:
                from timetable.models import Subject
                student = validated_data.get('student')
                subjects_qs = Subject.objects.none()
                student_level = getattr(student, 'level', None)
                campus = getattr(student, 'campus_from_classroom', None) or getattr(student, 'campus', None)

                if student_level and campus:
                    subjects_qs = Subject.objects.filter(level=student_level, campus=campus, is_active=True)
                if not subjects_qs.exists() and campus:
                    subjects_qs = Subject.objects.filter(campus=campus, is_active=True)

                for subj in subjects_qs.order_by('name'):
                    if subj.name in exclude_subjects:
                        continue
                    SubjectMark.objects.create(
                        result=result,
                        subject_name=subj.name,
                        organization=user.organization
                    )
            except Exception:
                pass
        else:
            for subject_data in subject_marks_data:
                SubjectMark.objects.create(
                    result=result,
                    organization=user.organization,
                    **subject_data
                )

        result.calculate_totals()
        return result


class ResultUpdateSerializer(serializers.ModelSerializer):
    subject_marks = SubjectMarkSerializer(many=True)

    class Meta:
        model = Result
        fields = ['subject_marks', 'attendance_score', 'total_attendance', 'teacher_remarks', 'is_absent']

    def to_representation(self, instance):
        return ResultSerializer(instance, context=self.context).data

    def update(self, instance, validated_data):
        if instance.status != 'draft' and instance.edit_count >= 2:
            raise serializers.ValidationError("Maximum edit limit reached (2 edits)")

        instance.attendance_score = validated_data.get('attendance_score', instance.attendance_score)
        instance.total_attendance = validated_data.get('total_attendance', instance.total_attendance)
        instance.teacher_remarks = validated_data.get('teacher_remarks', instance.teacher_remarks)
        instance.is_absent = validated_data.get('is_absent', instance.is_absent)

        subject_marks_data = validated_data.get('subject_marks', [])
        incoming_subject_names = [sm['subject_name'] for sm in subject_marks_data]
        instance.subject_marks.exclude(subject_name__in=incoming_subject_names).delete()

        for subject_data in subject_marks_data:
            defaults = subject_data.copy()
            if instance.organization:
                defaults['organization'] = instance.organization

            subject_mark, created = SubjectMark.objects.get_or_create(
                result=instance,
                subject_name=subject_data['subject_name'],
                defaults=defaults
            )
            if not created:
                for attr, value in subject_data.items():
                    setattr(subject_mark, attr, value)
                if instance.organization and not subject_mark.organization:
                    subject_mark.organization = instance.organization
                subject_mark.save()

        if instance.status != 'draft':
            instance.edit_count += 1

        instance.save()
        instance.calculate_totals()
        return instance


class ResultSubmitSerializer(serializers.ModelSerializer):
    class Meta:
        model = Result
        fields = []  # No fields required from client; backend sets status automatically

    def update(self, instance, validated_data):
        if instance.status not in ['draft', 'rejected']:
            raise serializers.ValidationError(
                f"Only draft or rejected results can be submitted. Current status: {instance.status}"
            )

        teacher = instance.teacher

        # All exam types (monthly, midterm, final) go to coordinator first
        if not instance.coordinator:
            if not teacher.assigned_coordinators.exists():
                raise serializers.ValidationError("No coordinator assigned to this teacher")
            instance.coordinator = teacher.assigned_coordinators.first()

        instance.status = 'pending_coordinator'
        instance.save()
        return instance


class ResultApprovalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Result
        fields = [
            'status', 
            'coordinator_comments', 
            'coordinator_signature', 
            'approved_by_coordinator',
            'approved_by_coordinator_at',
            'coordinator_signed_at'
        ]

    def update(self, instance, validated_data):
        allowed_statuses = ['submitted', 'under_review', 'pending', 'pending_coordinator']
        if instance.status not in allowed_statuses:
            raise serializers.ValidationError(
                f"Only results in {', '.join(allowed_statuses)} can be approved/rejected by a coordinator. "
                f"Current status: {instance.status}"
            )
        
        # Update all fields provided in validated_data
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
            
        instance.save()
        return instance
