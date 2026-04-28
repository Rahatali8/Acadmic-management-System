from django.db import models
from users.managers import OrganizationManager
from django.conf import settings
from students.models import Student
from teachers.models import Teacher
from coordinator.models import Coordinator

class Result(models.Model):
    # Custom manager for multi-tenancy
    objects = OrganizationManager()
    all_objects = models.Manager()
    EXAM_TYPE_CHOICES = [
        ('monthly', 'Monthly Test'),
        ('midterm', 'Mid Term'),
        ('final', 'Final Term'),
    ]
    
    MONTH_CHOICES = [
        ('April', 'April'), ('May', 'May'), ('June', 'June'),
        ('August', 'August'), ('September', 'September'), ('October', 'October'),
        ('November', 'November'), ('December', 'December'),
        ('January', 'January'), ('February', 'February'), ('March', 'March'),
    ]
    
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('pending_coordinator', 'Pending Coordinator'),
        ('pending_principal', 'Pending Principal'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    RESULT_STATUS_CHOICES = [
        ('pass', 'Pass'),
        ('fail', 'Fail'),
    ]

    PASS_STATUS_CHOICES = [
        ('pass', 'Pass'),
        ('fail', 'Fail'),
        ('absent', 'Absent'),
    ]
    
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='results')
    teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE, related_name='created_results')
    coordinator = models.ForeignKey(Coordinator, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_results')
    
    # Organization
    organization = models.ForeignKey(
        'users.Organization', 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True, 
        related_name='results'
    )
    
    exam_type = models.CharField(max_length=20, choices=EXAM_TYPE_CHOICES)
    month = models.CharField(max_length=20, choices=MONTH_CHOICES, null=True, blank=True, help_text="Required for Monthly Test")
    academic_year = models.CharField(max_length=10, default='2024-25')
    semester = models.CharField(max_length=20, default='Spring')
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    edit_count = models.PositiveIntegerField(default=0)

    # Absence & pass tracking
    is_absent = models.BooleanField(default=False)
    pass_status = models.CharField(max_length=10, choices=PASS_STATUS_CHOICES, default='fail')
    
    # Marks & Grading
    total_marks = models.FloatField(default=0)
    obtained_marks = models.FloatField(default=0)
    percentage = models.FloatField(default=0)
    grade = models.CharField(max_length=20, default='F')
    result_status = models.CharField(max_length=10, choices=RESULT_STATUS_CHOICES, default='fail')
    
    # Additional Fields
    attendance_score = models.FloatField(default=0, help_text="Days present")
    total_attendance = models.FloatField(default=0, help_text="Total working days")
    position = models.CharField(max_length=10, null=True, blank=True, help_text="Class position/rank (e.g. 1st, 2nd)")
    teacher_remarks = models.TextField(blank=True, null=True)
    coordinator_comments = models.TextField(blank=True, null=True)
    principal_comments = models.TextField(blank=True, null=True)

    # Audit Trail
    approved_by_coordinator = models.ForeignKey(Coordinator, on_delete=models.SET_NULL, null=True, blank=True, related_name='coordinator_approvals')
    approved_by_principal = models.ForeignKey('principals.Principal', on_delete=models.SET_NULL, null=True, blank=True, related_name='principal_approvals')
    approved_by_coordinator_at = models.DateTimeField(null=True, blank=True)
    approved_by_principal_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Digital Signatures
    coordinator_signature = models.TextField(null=True, blank=True)
    principal_signature = models.TextField(null=True, blank=True)
    coordinator_signed_at = models.DateTimeField(null=True, blank=True)
    principal_signed_at = models.DateTimeField(null=True, blank=True)
    
    @property
    def status_display(self):
        return self.get_status_display()

    @property
    def exam_type_display(self):
        return self.get_exam_type_display()

    @property
    def result_status_display(self):
        return self.get_result_status_display()

    def calculate_totals(self):
        """Calculate total marks, obtained marks, percentage, grade, result_status and pass_status."""
        # Absent student: zero marks, no calculation needed
        if self.is_absent:
            self.obtained_marks = 0
            self.percentage = 0
            self.grade = 'Absent'
            self.result_status = 'absent'
            self.pass_status = 'absent'
            # Also mark all subjects as absent for consistency
            self.subject_marks.all().update(is_absent=True, obtained_marks=0)
            self.save(update_fields=['total_marks', 'obtained_marks', 'percentage', 'grade', 'result_status', 'pass_status'])
            return

        total_marks = 0
        obtained_marks = 0
        all_subjects_pass = True

        behaviour_keywords = [
            'behaviour', 'behavior', 'response', 'observation', 'participation',
            'follow_rules', 'home_work', 'homework', 'personal_hygiene',
            'respect_others', 'follow rules', 'home work', 'personal hygiene', 'respect others'
        ]

        def is_behaviour_field(name):
            if not name:
                return False
            name_lower = name.lower().replace(' ', '_')
            return any(kw in name_lower for kw in behaviour_keywords)

        has_absent = False
        has_failed_attempt = False
        attempted_any = False

        for subject_mark in self.subject_marks.all():
            if is_behaviour_field(subject_mark.subject_name):
                continue
            
            total_marks += subject_mark.get_total_marks()
            obtained_marks += subject_mark.get_obtained_marks()
            
            if subject_mark.is_absent:
                has_absent = True
            else:
                attempted_any = True
                if not subject_mark.is_pass:
                    has_failed_attempt = True

        self.total_marks = total_marks
        self.obtained_marks = obtained_marks
        self.percentage = (obtained_marks / total_marks * 100) if total_marks > 0 else 0

        # Grading logic per requirement
        if self.is_absent:
            self.grade = 'Absent'
        elif self.percentage >= 80:
            self.grade = 'A+'
        elif self.percentage >= 70:
            self.grade = 'A'
        elif self.percentage >= 60:
            self.grade = 'B'
        elif self.percentage >= 50:
            self.grade = 'C'
        elif self.percentage >= 40:
            self.grade = 'D'
        else:
            self.grade = 'F'

        # Threshold depends on exam type
        # Monthly/Final: 40%, Mid Term: 33%
        passing_threshold = 33 if self.exam_type == 'midterm' else 40
        
        # Overall pass if: all attempted subjects passed AND percentage meets threshold AND no absences
        # BUT user wants specific "Absent" status if NO failures but SOME absences
        is_pass = attempted_any and not has_failed_attempt and not has_absent and self.percentage >= passing_threshold
        
        if self.is_absent or (has_absent and not has_failed_attempt and (not attempted_any or self.percentage >= passing_threshold)):
            # Student was either completely absent or only absent in some subjects without failing others
            self.pass_status = 'absent'
            self.result_status = 'absent'
            self.grade = 'Absent'
        elif has_failed_attempt or (attempted_any and self.percentage < passing_threshold) or (has_absent and has_failed_attempt):
            # Student failed an attempted subject or missed percentage threshold or mixed fail/absent
            self.pass_status = 'fail'
            self.result_status = 'fail'
            self.grade = 'F'
        elif is_pass:
            self.pass_status = 'pass'
            self.result_status = 'pass'
        else:
            # Fallback
            self.pass_status = 'fail'
            self.result_status = 'fail'
            self.grade = 'F'

        self.save(update_fields=['total_marks', 'obtained_marks', 'percentage', 'grade', 'result_status', 'pass_status'])
    
    def __str__(self):
        exam_label = f"{self.get_exam_type_display()}"
        if self.month:
            exam_label += f" ({self.month})"
        return f"{self.student.name} - {exam_label} ({self.status})"
    
    class Meta:
        ordering = ['-created_at']
        unique_together = ['student', 'exam_type', 'academic_year', 'semester', 'month']

class MonthlyResult(Result):
    class Meta:
        proxy = True
        verbose_name = "Monthly Test Result"
        verbose_name_plural = "Monthly Test Results"

class MidTermResult(Result):
    class Meta:
        proxy = True
        verbose_name = "Mid Term Result"
        verbose_name_plural = "Mid Term Results"

class FinalTermResult(Result):
    class Meta:
        proxy = True
        verbose_name = "Final Term Result"
        verbose_name_plural = "Final Term Results"

class SubjectMark(models.Model):
    # Custom manager for multi-tenancy
    objects = OrganizationManager()
    all_objects = models.Manager()
    SUBJECT_CHOICES = [
        ('quran_majeed', 'Quran Majeed'),
        ('islamiat', 'Islamiat'),
        ('urdu_written', 'Urdu (Written)'),
        ('urdu_oral', 'Urdu (Oral)'),
        ('sindhi_written', 'Sindhi (Written)'),
        ('english_written', 'English (Written)'),
        ('english_oral', 'English (Oral)'),
        ('maths_written', 'Maths (Written)'),
        ('maths_oral', 'Maths (Oral)'),
        ('social_studies_written', 'S. Studies / P.Studies (Written)'),
        ('social_studies_oral', 'S. Studies (Oral)'),
        ('science_written', 'G. Science / Chemistry (Written)'),
        ('science_oral', 'G. Science (Oral)'),
        ('drawing', 'Drawing'),
        ('computer_biology', 'Computer / Biology'),
        # Fallback/Generic
        ('mathematics', 'Mathematics'),
        ('science', 'Science'),
        ('social_studies', 'Social Studies'),
        ('computer_science', 'Computer Science'),
        ('other', 'Other'),
    ]
    
    result = models.ForeignKey(Result, on_delete=models.CASCADE, related_name='subject_marks')
    
    # Organization
    organization = models.ForeignKey(
        'users.Organization', 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True, 
        related_name='subject_marks'
    )
    subject_name = models.CharField(max_length=200)
    variant = models.CharField(max_length=100, blank=True, null=True, help_text="Specific variant name (e.g. Computer or Biology)")
    
    # Theory marks
    total_marks = models.FloatField(default=100)
    obtained_marks = models.FloatField(default=0)
    
    # Practical/Oral marks (Legacy support or standard practical)
    has_practical = models.BooleanField(default=False)
    practical_total = models.FloatField(default=0, null=True, blank=True)
    practical_obtained = models.FloatField(default=0, null=True, blank=True)
    
    # For non-numeric grading (e.g. Drawing might be graded A, B, C directly, or behaviour values like Excellent, Good)
    grade = models.CharField(max_length=50, blank=True, null=True, help_text="Optional manual grade override or behaviour value")
    
    is_pass = models.BooleanField(default=False)
    is_absent = models.BooleanField(default=False, help_text="Student was absent for this specific subject")
    
    def save(self, *args, **kwargs):
        # Determine pass/fail
        # Pass criteria: usually 40% of total
        total = self.get_total_marks()
        obtained = self.get_obtained_marks()
        
        # If student was absent for this subject, force fail with 0 marks
        if self.is_absent:
            self.obtained_marks = 0
            self.is_pass = False
            super().save(*args, **kwargs)
            return

        if total > 0:
            percentage = (obtained / total) * 100
        else:
            percentage = 0
            
        # Standard logic: Monthly/Final: 40%, Mid Term: 33%
        pass_threshold = 33 if self.result.exam_type == 'midterm' else 40
        
        # Use small tolerance for floating point comparisons
        self.is_pass = percentage >= (pass_threshold - 0.01)
        
        super().save(*args, **kwargs)
    
    def get_total_marks(self):
        """Get total marks including practical if applicable (Ignored for Monthly Tests)"""
        base = self.total_marks
        if self.result.exam_type != 'monthly' and self.has_practical and self.practical_total:
             base += self.practical_total
        return base
    
    def get_obtained_marks(self):
        """Get obtained marks including practical if applicable (Ignored for Monthly Tests)"""
        base = self.obtained_marks
        if self.result.exam_type != 'monthly' and self.has_practical and self.practical_obtained:
             base += self.practical_obtained
        return base
    
    def __str__(self):
        return f"{self.result.student.name} - {self.subject_name}"
    
    class Meta:
        ordering = ['subject_name']
        unique_together = ['result', 'subject_name']
