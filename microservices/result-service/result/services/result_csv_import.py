import csv
from typing import List, Dict, Any, Tuple
from django.db import transaction
from students.models import Student
from teachers.models import Teacher
from result.models import Result, SubjectMark


def _resolve_student(identifier: str, id_type: str):
    qs = Student.objects
    if id_type == 'student_id':
        return qs.filter(student_id=identifier).first()
    if id_type == 'gr_no':
        return qs.filter(gr_no=identifier).first()
    if id_type == 'student_code':
        return qs.filter(student_code=identifier).first()
    return None


def import_results_from_csv(path: str, teacher_id: int = None, overwrite: bool = False, chunk_size: int = 200) -> List[Dict[str, Any]]:
    """
    Import results from a CSV file. Expected headers:
    student_identifier,student_identifier_type,exam_type,academic_year,month,subject_name,total_marks,obtained_marks,grade,teacher_id,remarks

    Returns list of per-row reports: {row, status, message}
    """

    from result.models import Result  # Ensure Result is always available

    # Read CSV file and collect rows as list of dicts
    rows = []
    with open(path, newline='', encoding='utf-8-sig') as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            rows.append(row)

    reports = []

    # process in chunks
    for i in range(0, len(rows), chunk_size):
        chunk = rows[i:i+chunk_size]
        with transaction.atomic():
            for idx, row in enumerate(chunk, start=i+1):
                report = {'row': idx, 'status': 'ok', 'message': ''}
                try:
                    sid = (row.get('student_identifier') or '').strip()
                    sid_type = (row.get('student_identifier_type') or 'student_id').strip()
                    # Normalize exam_type and month for frontend compatibility
                    exam_type = (row.get('exam_type') or '').strip().lower()
                    if exam_type in ['monthly', 'monthly test', 'monthly_test']:
                        exam_type = 'monthly'
                    elif exam_type in ['midterm', 'mid_term', 'mid term']:
                        exam_type = 'midterm'
                    elif exam_type in ['finalterm', 'final_term', 'final term', 'final']:
                        exam_type = 'final'
                    academic_year = (row.get('academic_year') or '').strip()
                    month = (row.get('month') or '').strip().capitalize() or None
                    # Only allow valid months
                    valid_months = ['April','May','June','August','September','October','November','December','January','February','March']
                    if month and month not in valid_months:
                        month = None
                    row_teacher_id = row.get('teacher_id')
                    remarks = row.get('remarks')

                    # Allow academic_year to be optional for monthly_test uploads
                    if not sid or not exam_type:
                        raise ValueError('Missing required fields (student_identifier/exam_type)')
                    if not academic_year:
                        if exam_type == 'monthly':
                            academic_year = Result._meta.get_field('academic_year').get_default()
                        else:
                            raise ValueError('Missing required fields (academic_year)')

                    student = _resolve_student(sid, sid_type)
                    if not student:
                        raise ValueError(f'Student not found: {sid} ({sid_type})')

                    # determine teacher
                    # Always use the logged-in teacher (ignore teacher_id from CSV rows)
                    assigned_teacher = None
                    if teacher_id:
                        try:
                            assigned_teacher = Teacher.objects.filter(id=int(teacher_id)).first()
                        except (ValueError, TypeError):
                            assigned_teacher = None
                        if not assigned_teacher:
                            assigned_teacher = Teacher.objects.filter(teacher_id=teacher_id).first()
                    if not assigned_teacher:
                        raise ValueError('No teacher specified or found (provide --teacher-id argument)')

                    # SECURITY: Validate that the teacher_id column in the CSV matches the logged-in teacher
                    # This prevents uploading a CSV that was made for a different teacher
                    csv_teacher_id = (row.get('teacher_id') or '').strip()
                    if csv_teacher_id:
                        # Compare against teacher's employee_code and teacher_id fields
                        teacher_employee_code = (getattr(assigned_teacher, 'employee_code', '') or '').strip()
                        teacher_code = (getattr(assigned_teacher, 'teacher_id', '') or '').strip()
                        if (csv_teacher_id != teacher_employee_code and csv_teacher_id != teacher_code):
                            raise ValueError(
                                f'CSV teacher_id "{csv_teacher_id}" does not match your teacher ID '
                                f'("{teacher_employee_code}"). You can only upload results using your own teacher ID.'
                            )

                    # SECURITY: Verify the student belongs to the teacher's assigned classroom(s)
                    # Get all classroom IDs assigned to this teacher
                    teacher_classroom_ids = set()
                    if assigned_teacher.assigned_classroom_id:
                        teacher_classroom_ids.add(assigned_teacher.assigned_classroom_id)
                    if assigned_teacher.pk:
                        try:
                            for cls in assigned_teacher.assigned_classrooms.all():
                                teacher_classroom_ids.add(cls.id)
                        except Exception:
                            pass

                    if teacher_classroom_ids:
                        # Get the student's classroom id directly from DB
                        from students.models import Student as StudentModel
                        student_classroom_id = StudentModel.objects.filter(id=student.id).values_list('classroom_id', flat=True).first()
                        
                        if not student_classroom_id or student_classroom_id not in teacher_classroom_ids:
                            raise ValueError(
                                f'Student {sid} does not belong to your assigned classroom. '
                                f'You can only upload results for your own students.'
                            )

                    # BLOCK: Final Term upload requires Mid Term to be FULLY APPROVED (by both coordinator AND principal)
                    if exam_type == 'final':
                        mid_term_approved = Result.objects.filter(
                            student=student,
                            exam_type='midterm',
                            status='approved'  # 'approved' means both coordinator AND principal have approved
                        ).exists()
                        if not mid_term_approved:
                            # Check what status mid-term is in for a better error message
                            mid_term = Result.objects.filter(student=student, exam_type='midterm').first()
                            if not mid_term:
                                raise ValueError(
                                    f'Student {student.name}: Mid Term result does not exist. '
                                    f'Final Term cannot be uploaded until Mid Term is fully approved by coordinator and principal.'
                                )
                            elif mid_term.status == 'pending_coordinator':
                                raise ValueError(
                                    f'Student {student.name}: Mid Term result is still pending coordinator approval. '
                                    f'Both coordinator and principal must approve Mid Term before uploading Final Term.'
                                )
                            elif mid_term.status == 'pending_principal':
                                raise ValueError(
                                    f'Student {student.name}: Mid Term result is approved by coordinator but still pending principal approval. '
                                    f'Principal must approve Mid Term before uploading Final Term.'
                                )
                            else:
                                raise ValueError(
                                    f'Student {student.name}: Mid Term result (status: {mid_term.status}) is not fully approved. '
                                    f'Both coordinator and principal must approve Mid Term before uploading Final Term.'
                                )

                    # Always delete any existing result for this student/exam/month/year/semester before creating new
                    key = {'student': student, 'exam_type': exam_type, 'month': month}
                    if academic_year:
                        key['academic_year'] = academic_year
                    # Also use semester if present (default to 'Spring')
                    semester = 'Spring'
                    Result.objects.filter(**key, semester=semester).delete()
                    result = Result.objects.create(teacher=assigned_teacher, semester=semester, status='draft', **key)
                    created = True
                    print(f"[DEBUG] Row {idx}: Result CREATED for student={student}, exam_type={exam_type}, month={month}, teacher={assigned_teacher}")

                    # Wide-format: handle all subject columns in the row
                    known_fields = {'student_identifier','student_identifier_type','exam_type','academic_year','month','teacher_id','remarks','grade','total_marks','obtained_marks','subject_name'}
                    subject_cols = [k for k in row.keys() if k not in known_fields]
                    subject_marks_created = 0
                    # Set per-exam-type default total marks
                    if exam_type == 'monthly':
                        default_total = 25
                    elif exam_type == 'midterm':
                        default_total = 75
                    elif exam_type == 'final':
                        default_total = 100
                    else:
                        default_total = 100
                    
                    # Behaviour field detection
                    behaviour_keywords = ['behaviour', 'behavior', 'response', 'observation', 'participation', 
                                          'follow_rules', 'home_work', 'homework', 'personal_hygiene', 
                                          'respect_others', 'follow rules', 'home work', 'personal hygiene', 'respect others']
                    
                    def is_behaviour_column(col_name):
                        col_lower = col_name.lower().replace(' ', '_')
                        return any(kw in col_lower for kw in behaviour_keywords)
                    
                    for subject_col in subject_cols:
                        subject_name = subject_col.strip()
                        raw_value = row.get(subject_col)
                        if raw_value in (None, '', 'NA'):
                            continue
                        
                        # Check if this is a behaviour column
                        if is_behaviour_column(subject_name):
                            # Store behaviour text value in grade field, not obtained_marks
                            # Behaviour values: Excellent, Good, Satisfactory, Needs Improvement, etc.
                            behaviour_value = str(raw_value).strip()
                            sm_defaults = {'total_marks': 100, 'obtained_marks': 0, 'grade': behaviour_value}
                            subject_mark, sm_created = SubjectMark.objects.get_or_create(result=result, subject_name=subject_name, defaults=sm_defaults)
                            if not sm_created and overwrite:
                                subject_mark.grade = behaviour_value
                                subject_mark.save()
                        else:
                            # Regular subject - parse as numeric
                            try:
                                obtained_marks = float(raw_value)
                            except Exception:
                                obtained_marks = 0.0
                            sm_defaults = {'total_marks': default_total, 'obtained_marks': obtained_marks, 'grade': ''}
                            subject_mark, sm_created = SubjectMark.objects.get_or_create(result=result, subject_name=subject_name, defaults=sm_defaults)
                            if not sm_created and overwrite:
                                subject_mark.obtained_marks = obtained_marks
                                subject_mark.save()
                        subject_marks_created += 1

                    # If no subject columns found, fallback to old format (single subject per row)
                    if subject_marks_created == 0:
                        subject_name = (row.get('subject_name') or '').strip()
                        if not subject_name:
                            raise ValueError('Missing required fields (subject_name or subject columns)')
                        # Use per-exam-type default if not specified
                        if row.get('total_marks') not in (None, '', 'NA'):
                            total_marks = float(row.get('total_marks'))
                        else:
                            if exam_type == 'monthly':
                                total_marks = 25
                            elif exam_type == 'midterm':
                                total_marks = 75
                            elif exam_type == 'final':
                                total_marks = 100
                            else:
                                total_marks = 100
                        obtained_marks = row.get('obtained_marks')
                        obtained_marks = float(obtained_marks) if obtained_marks not in (None, '', 'NA') else 0.0
                        grade = (row.get('grade') or '').strip() or None
                        sm_defaults = {'total_marks': total_marks, 'obtained_marks': obtained_marks, 'grade': grade or ''}
                        subject_mark, sm_created = SubjectMark.objects.get_or_create(result=result, subject_name=subject_name, defaults=sm_defaults)
                        if not sm_created and overwrite:
                            subject_mark.total_marks = total_marks
                            subject_mark.obtained_marks = obtained_marks
                            if grade:
                                subject_mark.grade = grade
                            subject_mark.save()

                    result.calculate_totals()
                    print(f"[DEBUG] Row {idx}: Result saved: id={result.id}, status={result.status}, total_marks={result.total_marks}, obtained_marks={result.obtained_marks}")
                    report['message'] = f"Result {'created' if created else 'updated'}, SubjectMarks added: {subject_marks_created} (status: draft, visible to teacher)"
                except Exception as e:
                    print(f"[ERROR] Row {idx}: {e}")
                    report['status'] = 'error'
                    report['message'] = str(e)
                reports.append(report)
    return reports

    # Remove duplicate/erroneous code at the end
 