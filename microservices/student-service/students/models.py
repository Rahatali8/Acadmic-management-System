# models.py

from django.db import models
from django.utils import timezone
from django.db.models import Q
from django.core.validators import RegexValidator
from django.core.exceptions import ValidationError
from phonenumber_field.modelfields import PhoneNumberField
from .validators import StudentValidator


from users.managers import OrganizationManager

class FormOption(models.Model):
    OPTION_CATEGORIES = (
        ('gender', 'Gender'),
        ('religion', 'Religion'),
        ('mother_tongue', 'Mother Tongue'),
        ('nationality', 'Nationality'),
        ('blood_group', 'Blood Group'),
        ('special_needs', 'Special Needs'),
        ('emergency_relationship', 'Emergency Relationship'),
        ('father_status', 'Father Status'),
        ('mother_status', 'Mother Status'),
        ('marital_status', 'Marital Status'),
        ('shift', 'Shift'),
        ('section', 'Section'),
    )
    
    # Custom manager for multi-tenancy
    objects = OrganizationManager()
    
    organization = models.ForeignKey('users.Organization', on_delete=models.CASCADE, null=True, blank=True, related_name='form_options')
    category = models.CharField(max_length=50, choices=OPTION_CATEGORIES)
    value = models.CharField(max_length=100)
    label = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        unique_together = ('organization', 'category', 'value')
        ordering = ['category', 'label']

    def __str__(self):
        return f"{self.get_category_display()} - {self.label}"


class StudentManager(OrganizationManager):
    """Custom manager to exclude soft deleted students by default and filter by organization"""
    
    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)
    
    def with_deleted(self):
        """Return all students including soft deleted ones"""
        return super().get_queryset()
    
    def only_deleted(self):
        """Return only soft deleted students"""
        return super().get_queryset().filter(is_deleted=True)


class Student(models.Model):
    # Custom manager
    objects = StudentManager()
    
    # --- User Account Link ---
    user = models.OneToOneField(
        'users.User', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='student_profile',
        help_text="User account associated with this student"
    )
    
    # --- Organization for Multi-tenant ---
    organization = models.ForeignKey('users.Organization', on_delete=models.CASCADE, null=True, blank=True, related_name='students')
    
    # --- Personal Details ---
    photo = models.ImageField(upload_to="students/photos/", null=True, blank=True)
    name = models.CharField(
        max_length=200,
        validators=[StudentValidator.validate_name],
        help_text="Student's full name"
    )
    gender = models.CharField(
        max_length=10,
        choices=(("male", "Male"), ("female", "Female")),
        null=True,
        blank=True
    )
    dob = models.DateField(
        null=True, 
        blank=True,
        validators=[StudentValidator.validate_date_of_birth],
        help_text="Date of birth (student must be 3-25 years old)"
    )
    place_of_birth = models.CharField(max_length=200, null=True, blank=True)
    religion = models.CharField(max_length=100, null=True, blank=True)
    mother_tongue = models.CharField(max_length=100, null=True, blank=True)
    student_cnic = models.CharField(
        max_length=20, 
        null=True, 
        blank=True,
        validators=[StudentValidator.validate_cnic],
        help_text="Student's B-Form / CNIC (13 digits)"
    )
    nationality = models.CharField(max_length=100, null=True, blank=True)
    blood_group = models.CharField(max_length=10, null=True, blank=True)
    special_needs_disability = models.CharField(max_length=100, null=True, blank=True)
    email = models.EmailField(null=True, blank=True, help_text="Student's email address (optional)")

    # --- Student Contact Details ---
    country_code = models.CharField(max_length=10, null=True, blank=True, help_text="Default country code (e.g. +92)")
    phone_number = PhoneNumberField(null=True, blank=True, help_text="Student's phone number")

    # --- Contact Details ---
    emergency_contact = PhoneNumberField(
        null=True, 
        blank=True,
        help_text="Emergency contact number"
    )
    emergency_relationship = models.CharField(max_length=50, null=True, blank=True)
    father_name = models.CharField(max_length=200, null=True, blank=True)
    father_cnic = models.CharField(
        max_length=20, 
        null=True, 
        blank=True,
        validators=[StudentValidator.validate_cnic],
        help_text="Father's CNIC (13 digits)"
    )
    father_contact = PhoneNumberField(
        null=True, 
        blank=True,
        help_text="Father's contact number"
    )
    father_profession = models.CharField(max_length=200, null=True, blank=True)

    guardian_name = models.CharField(max_length=200, null=True, blank=True)
    guardian_cnic = models.CharField(
        max_length=20, 
        null=True, 
        blank=True,
        validators=[StudentValidator.validate_cnic],
        help_text="Guardian's CNIC (13 digits)"
    )
    guardian_profession = models.CharField(max_length=200, null=True, blank=True)
    guardian_contact = PhoneNumberField(
        null=True, 
        blank=True,
        help_text="Guardian's contact number"
    )

    mother_name = models.CharField(max_length=200, null=True, blank=True)
    mother_cnic = models.CharField(
        max_length=20, 
        null=True, 
        blank=True,
        validators=[StudentValidator.validate_cnic],
        help_text="Mother's CNIC (13 digits)"
    )
    mother_status = models.CharField(
        max_length=20,
        choices=(("widowed", "Widowed"), ("divorced", "Divorced"), ("married", "Married")),
        null=True,
        blank=True
    )
    mother_contact = PhoneNumberField(
        null=True, 
        blank=True,
        help_text="Mother's contact number"
    )
    mother_profession = models.CharField(max_length=200, null=True, blank=True)


    address = models.TextField(
        null=True, 
        blank=True,
        validators=[StudentValidator.validate_address],
        help_text="Complete address (10-500 characters)"
    )
    family_income = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        null=True, 
        blank=True,
        validators=[StudentValidator.validate_positive_number],
        help_text="Monthly family income in PKR"
    )
    house_owned = models.CharField(
        max_length=10,
        choices=(("yes", "Yes"), ("no", "No")),
        null=True,
        blank=True,
        help_text="Is the house owned by the family?"
    )
    zakat_status = models.CharField(
        max_length=20,
        choices=(("applicable", "Applicable"), ("not_applicable", "Not Applicable")),
        null=True,
        blank=True,
        help_text="Zakat eligibility status"
    )

    # --- Academic Details ---
    terminated_on = models.DateTimeField(null=True, blank=True)
    termination_reason = models.TextField(null=True, blank=True)

    # Campus reference - set to null if campus is deleted (data preservation)
    campus = models.ForeignKey("campus.Campus", on_delete=models.SET_NULL, null=True, blank=True)
    current_grade = models.CharField(max_length=50, null=True, blank=True)
    section = models.CharField(max_length=10, null=True, blank=True)
    last_class_teacher = models.CharField(max_length=200, null=True, blank=True)
    old_gr_number = models.CharField(max_length=50, null=True, blank=True)
    transfer_reason = models.TextField(null=True, blank=True)
    siblings_count = models.PositiveIntegerField(
        null=True, 
        blank=True,
        help_text="Number of siblings (positive integer)"
    )
    father_status = models.CharField(
        max_length=20,
        choices=(
            ("alive", "Alive"),
            ("dead", "Dead"),
        ),
        null=True,
        blank=True
    )
    gr_no = models.CharField(max_length=50, null=True, blank=True, unique=False)

    # --- ID Generation Fields ---
    student_id = models.CharField(max_length=20, null=True, blank=True)
    student_code = models.CharField(max_length=20, editable=False, null=True, blank=True)
    enrollment_year = models.IntegerField(
        null=True, 
        blank=True,
        validators=[StudentValidator.validate_year],
        help_text="Year of enrollment (2000-2030)"
    )
    shift = models.CharField(
        max_length=20,
        choices=[
            ('morning', 'Morning'),
            ('afternoon', 'Afternoon'),
        ],
        null=True,
        blank=True,
        help_text="Student's shift"
    )

    # --- System Fields ---
    is_draft = models.BooleanField(default=True)
    is_deleted = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True, help_text="Active students appear in attendance sheets and class lists")
    deleted_at = models.DateTimeField(null=True, blank=True)
    dynamic_data = models.JSONField(default=dict, blank=True, null=True, help_text="Stores extra dynamic form data")
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    classroom = models.ForeignKey(
        'classes.ClassRoom',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='students',
        help_text="Classroom where student is enrolled"
    )

    # --- Properties ---
    @property
    def campus_from_classroom(self):
        return self.classroom.campus if self.classroom else self.campus

    @property
    def full_name(self):
        return self.name

    @property
    def level(self):
        return self.classroom.level if self.classroom else None

    @property
    def grade_from_classroom(self):
        return self.classroom.grade if self.classroom else None

    @property
    def level(self):
        # Expose level based on classroom/grade relationship when available
        try:
            return self.classroom.grade.level if self.classroom and self.classroom.grade else None
        except Exception:
            return None

    @property
    def class_teacher(self):
        return self.classroom.class_teacher if self.classroom else None

    def __str__(self):
        return f"{self.name} ({self.student_code or self.student_id or self.gr_no or 'No ID'})"
    
    def soft_delete(self):
        """Soft delete the student - uses update() to bypass signals"""
        import logging
        logger = logging.getLogger(__name__)
        
        if not self.pk:
            raise ValueError("Cannot soft delete student without primary key")
        
        logger.info(f"[SOFT_DELETE] soft_delete() called for student PK: {self.pk}, Name: {self.name}")
        
        updated_count = Student.objects.with_deleted().filter(pk=self.pk).update(
            is_deleted=True,
            deleted_at=timezone.now(),
            terminated_on=timezone.now(),
            termination_reason="Deleted from system"
        )
        
        logger.info(f"[SOFT_DELETE] Database update() returned updated_count: {updated_count}")
        
        if updated_count == 0:
            logger.error(f"[SOFT_DELETE] CRITICAL: update() returned 0 - no rows were updated! Student PK: {self.pk}")
            raise Exception(f"Soft delete failed - no rows updated for student PK: {self.pk}")
        
        # Refresh instance from database
        self.refresh_from_db()
        logger.info(f"[SOFT_DELETE] After refresh_from_db(), is_deleted: {self.is_deleted}")
    
    def restore(self):
        """Restore a soft deleted student"""
        self.is_deleted = False
        self.deleted_at = None
        self.terminated_on = None
        self.termination_reason = None
        self.save()
    
    def delete(self, using=None, keep_parents=False):
        """
        Override delete() to prevent accidental hard deletes.
        Always use soft_delete() instead.
        """
        # If someone accidentally calls .delete(), use soft delete instead
        if not self.is_deleted:
            self.soft_delete()
        else:
            # If already soft deleted and someone wants to hard delete, they must explicitly call hard_delete()
            raise ValueError(
                "Cannot hard delete student. Use hard_delete() method explicitly if you really want to permanently delete."
            )
    
    def hard_delete(self):
        """Permanently delete the student from database - use with caution!"""
        super().delete()
    
    def _auto_assign_classroom(self):
        """
        Automatically assign classroom based on campus, grade, section, and shift
        """
        try:
            from classes.models import ClassRoom, Grade
            
            # Normalize grade names for matching (e.g. "Grade 10" <-> "Class 10")
            clean_name = self.current_grade.lower().replace('grade', '').replace('class', '').strip()
            grade_name_variations = [
                self.current_grade,
                clean_name,
                f"Grade {clean_name}",
                f"Class {clean_name}",
                self.current_grade.replace('-', ' '),
                self.current_grade.replace(' ', '-'),
            ]
            
            # Find matching grade
            grade_query = Q()
            for grade_var in set(grade_name_variations):
                grade_query |= Q(name__iexact=grade_var) | Q(name__icontains=grade_var)
            
            # Find grades in the same campus
            matching_grades = Grade.objects.filter(
                grade_query,
                level__campus=self.campus
            )
            
            if not matching_grades.exists():
                print(f"[ERROR] No matching grade found for '{self.current_grade}' in campus '{self.campus.campus_name}'")
                return
            
            # Find classroom with matching grade, section, and shift
            classroom = ClassRoom.objects.filter(
                grade__in=matching_grades,
                section=self.section,
                shift=self.shift
            ).first()
            
            if classroom:
                self.classroom = classroom
                print(f"[OK] Auto-assigned student '{self.name}' to classroom '{classroom.grade.name}-{classroom.section}' ({classroom.shift})")
                
                # If classroom has a teacher, student is automatically connected to that teacher
                if classroom.class_teacher:
                    print(f"[OK] Student '{self.name}' is now connected to teacher '{classroom.class_teacher.full_name}'")
            else:
                print(f"[ERROR] No classroom found for Grade: {self.current_grade}, Section: {self.section}, Shift: {self.shift} in campus '{self.campus.campus_name}'")
                print(f"[INFO] Please create a classroom first for this combination")
                
        except Exception as e:
            error_msg = str(e).encode('ascii', 'replace').decode('ascii') if isinstance(str(e), str) else repr(e)
            print(f"[ERROR] Error in auto-assignment: {error_msg}")
            import traceback
            try:
                traceback.print_exc()
            except UnicodeEncodeError:
                print("[ERROR] Could not print traceback due to encoding error")

    def save(self, *args, **kwargs):
        # Set termination date automatically
        if hasattr(self, 'current_state') and self.current_state == "terminated" and not self.terminated_on:
            self.terminated_on = timezone.now()

        # Prevent termination fields from appearing at add time
        if not self.pk:  # means this is a new student
            self.terminated_on = None
            self.termination_reason = None

        # If classroom is explicitly assigned, sync grade, section, shift, and campus from it
        if self.classroom:
            if self.classroom.grade:
                self.current_grade = self.classroom.grade.name
            if self.classroom.section:
                self.section = self.classroom.section
            if self.classroom.shift:
                self.shift = self.classroom.shift
            if self.classroom.campus:
                self.campus = self.classroom.campus
            
            # If assigned to a classroom, ensure student is active
            if not self.is_active:
                self.is_active = True
                
        # If student is marked as Alumni, ensure they are inactive
        elif self.current_grade == 'Alumni':
            self.is_active = False
            self.classroom = None
            self.section = None
            
        # Otherwise, try to auto-assign classroom based on grade/section/shift ONLY during creation
        is_create = not self.pk
        if not self.classroom and is_create and all([self.campus, self.current_grade, self.section, self.shift]):
            self._auto_assign_classroom()
            # If creating and still no classroom, prevent save ONLY IF it is not a draft
            # Drafts can exist without a classroom assignment
            if not self.classroom and not self.is_draft:
                raise ValidationError({
                    'classroom': 'No classroom is available for the selected campus/grade/section/shift. Please create the classroom first.'
                })

        # Generate student code or ID
        if not self.student_code and self.classroom:
            try:
                from utils.id_generator import IDGenerator
                self.student_code = IDGenerator.generate_unique_student_code(
                    self.classroom, self.enrollment_year or 2025
                )
            except Exception as e:
                print(f"Error generating student code: {str(e)}")

        # Generate student_id using global student sequence
        if not self.student_id and all([self.campus, self.shift, self.enrollment_year]):
            try:
                from users.utils import generate_student_id, get_shift_code, get_next_student_number
                campus_code = self.campus.campus_code or f"C{self.campus.id:02d}"
                shift_code = get_shift_code(self.shift)
                year = str(self.enrollment_year)[-2:]
                seq = get_next_student_number(self.campus, self.enrollment_year)
                self.student_id = generate_student_id(campus_code, shift_code, year, seq)
                # Set GR number from sequence
                if not self.gr_no:
                    self.gr_no = f"GR-{seq:05d}"
            except Exception as e:
                print(f"Error generating student id: {e}")

        # Auto-generate GR No. from Student ID (last 5 digits)
        if self.student_id and not self.gr_no:
            # Extract last 5 digits from student_id
            if len(self.student_id) >= 5:
                last_5_digits = self.student_id[-5:]
                self.gr_no = f"GR-{last_5_digits}"
            else:
                # If student_id is shorter than 5 digits, pad with zeros
                padded_id = self.student_id.zfill(5)
                self.gr_no = f"GR-{padded_id}"

        super().save(*args, **kwargs)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['organization', 'email'], condition=Q(is_deleted=False), name='unique_active_student_email_per_org'),
            models.UniqueConstraint(fields=['organization', 'student_cnic'], condition=Q(is_deleted=False), name='unique_active_student_cnic_per_org'),
            models.UniqueConstraint(fields=['organization', 'student_id'], condition=Q(is_deleted=False), name='unique_active_student_id_per_org')
        ]
        verbose_name = "Student"
        verbose_name_plural = "Students"
        ordering = ['-created_at']