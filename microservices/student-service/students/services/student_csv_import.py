import csv
import io
from django.db import transaction

REQUIRED_FIELDS = ['name', 'gender', 'dob', 'grade', 'section', 'shift', 'admission_year']

OPTIONAL_FIELDS = ['student_id', 'classroom', 'campus', 'religion', 'mother_tongue', 'emergency_contact', 'address', 'siblings_count',
                   'email', 'phone_number', 'father_name', 'father_contact',
                   'mother_name', 'mother_contact', 'guardian_name', 'guardian_contact',
                   'blood_group', 'student_cnic', 'nationality', 'place_of_birth',
                   'father_cnic', 'mother_cnic', 'guardian_cnic', 'emergency_relationship']


TEMPLATE_HEADERS = REQUIRED_FIELDS + OPTIONAL_FIELDS

SAMPLE_ROW = {
    'name': 'Ahmed Khan',
    'student_id': 'KHI-001',
    'classroom': 'Grade 3 - A',
    'campus': 'Karachi Campus',
    'gender': 'male',
    'dob': '2015-03-15',
    'religion': 'Islam',
    'mother_tongue': 'Urdu',
    'emergency_contact': '+923001234567',
    'address': 'House 12 Street 4 Block A Karachi',
    'siblings_count': '2',
    'grade': 'Grade 3',
    'section': 'A',
    'shift': 'morning',
    'admission_year': '2024',
    'email': '',
    'phone_number': '',
    'father_name': 'Muhammad Khan',
    'father_contact': '+923009876543',
    'mother_name': 'Fatima Khan',
    'mother_contact': '',
    'guardian_name': '',
    'guardian_contact': '',
    'blood_group': 'B+',
    'student_cnic': '',
    'nationality': 'Pakistani',
    'place_of_birth': 'Karachi',
    'father_cnic': '',
    'mother_cnic': '',
    'guardian_cnic': '',
    'emergency_relationship': 'Father',
}



def generate_template_csv():
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=TEMPLATE_HEADERS)
    writer.writeheader()
    writer.writerow(SAMPLE_ROW)
    return output.getvalue()


def import_students_from_csv(path, user):
    """
    Read CSV at `path` and create Student records for each row.
    `user` is the authenticated user (org_admin or principal).
    Returns a list of per-row report dicts: {row, status, message, name?}
    """
    from students.models import Student
    from campus.models import Campus

    # Resolve org and optional campus scope from user
    org = getattr(user, 'organization', None)
    user_campus = None
    if user.is_principal():
        user_campus = getattr(user, 'campus', None)
        if not user_campus:
            try:
                from principals.models import Principal
                p = Principal.objects.get(employee_code=user.username)
                user_campus = p.campus
            except Exception:
                pass

    reports = []

    try:
        with open(path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
    except Exception as e:
        return [{'row': 0, 'status': 'error', 'message': f'Could not read file: {e}'}]

    if not rows:
        return [{'row': 0, 'status': 'error', 'message': 'CSV file is empty or has no data rows.'}]

    # Validate headers
    if reader.fieldnames:
        missing_headers = [h for h in REQUIRED_FIELDS if h not in reader.fieldnames]
        if missing_headers:
            return [{'row': 0, 'status': 'error',
                     'message': f'Missing required columns: {", ".join(missing_headers)}'}]

    for idx, row in enumerate(rows, start=2):  # row 1 = header
        row_num = idx
        name = (row.get('name') or '').strip()

        try:
            # --- Validate required fields ---
            missing = [f for f in REQUIRED_FIELDS if not (row.get(f) or '').strip()]
            if missing:
                reports.append({'row': row_num, 'status': 'error', 'name': name or '—',
                                'message': f'Missing required fields: {", ".join(missing)}'})
                continue

            grade_name = row['grade'].strip()
            section = row['section'].strip().upper()
            shift = row['shift'].strip().lower()
            admission_year_str = row['admission_year'].strip()

            # Validate shift
            if shift not in ('morning', 'afternoon'):
                reports.append({'row': row_num, 'status': 'error', 'name': name,
                                'message': f'Invalid shift "{shift}". Use "morning" or "afternoon".'})
                continue

            # Validate section
            if section not in ('A', 'B', 'C', 'D', 'E', 'F'):
                reports.append({'row': row_num, 'status': 'error', 'name': name,
                                'message': f'Invalid section "{section}". Use A-F.'})
                continue

            # Validate admission year
            try:
                admission_year = int(admission_year_str)
                if not (2000 <= admission_year <= 2030):
                    raise ValueError()
            except ValueError:
                reports.append({'row': row_num, 'status': 'error', 'name': name,
                                'message': f'Invalid admission_year "{admission_year_str}". Must be 2000–2030.'})
                continue

            # Validate gender
            gender = row['gender'].strip().lower()
            if gender not in ('male', 'female'):
                reports.append({'row': row_num, 'status': 'error', 'name': name,
                                'message': f'Invalid gender "{gender}". Use "male" or "female".'})
                continue

            # Validate dob
            from django.utils.dateparse import parse_date
            dob = parse_date(row['dob'].strip())
            if not dob:
                reports.append({'row': row_num, 'status': 'error', 'name': name,
                                'message': f'Invalid dob "{row["dob"]}". Use YYYY-MM-DD format.'})
                continue

            # Build optional fields helper
            def opt(key):
                v = (row.get(key) or '').strip()
                return v if v else None

            student_id_val = opt('student_id')
            classroom_str = opt('classroom')
            campus_name_val = opt('campus')

            # Resolve campus and classroom
            campus = user_campus
            assigned_classroom = None

            # 1. Resolve explicit campus if provided (Crucial for Org Admins)
            if campus_name_val and org:
                from campus.models import Campus
                from django.db.models import Q
                # Try exact code, then icontains name, then check if the ID is at the end
                campus = Campus.objects.filter(
                    Q(campus_name__icontains=campus_name_val) | 
                    Q(campus_code__iexact=campus_name_val) |
                    Q(campus_code__icontains=campus_name_val.replace(' ', ''))
                ).filter(organization=org).first()
                
                # If still not found, try searching just for the digits if it looks like "Campus X"
                if not campus and any(char.isdigit() for char in campus_name_val):
                    import re
                    digits = re.findall(r'\d+', campus_name_val)
                    if digits:
                        num = str(int(digits[0])) # "01" -> "1"
                        campus = Campus.objects.filter(
                            Q(campus_name__icontains=num) | Q(campus_code__icontains=num),
                            organization=org
                        ).first()

            # 2. Try to resolve via explicit 'classroom' field first
            if classroom_str:
                from classes.models import ClassRoom
                from django.db.models import Q
                
                base_query = ClassRoom.objects.filter(organization=org)
                if campus:
                    base_query = base_query.filter(grade__level__campus=campus)
                
                # Try exact code or name
                assigned_classroom = base_query.filter(Q(code=classroom_str) | Q(code__icontains=classroom_str)).first()
                
                if not assigned_classroom:
                    # Try fuzzy match for "Grade X - Y" or "Class X - Y"
                    norm_classroom = classroom_str.lower().replace('grade', '').replace('class', '').strip()
                    if ' - ' in norm_classroom:
                        g_part, s_part = norm_classroom.split(' - ', 1)
                        assigned_classroom = base_query.filter(
                            Q(grade__name__icontains=g_part.strip()) & Q(section__iexact=s_part.strip())
                        ).first()
                
                if assigned_classroom and not campus:
                    campus = assigned_classroom.campus

            # 3. Fallback to grade match within org if campus still unknown
            if not campus and org:
                from classes.models import Grade
                # Normalize grade name (Grade 10 -> Class 10 fallback)
                norm_grade = grade_name.lower().replace('grade', '').replace('class', '').strip()
                matching_grade = Grade.objects.filter(
                    Q(name__icontains=grade_name) | Q(name__icontains=norm_grade),
                    organization=org
                ).select_related('campus').first()
                if matching_grade and matching_grade.campus:
                    campus = matching_grade.campus

            if not campus:
                reports.append({'row': row_num, 'status': 'error', 'name': name,
                                'message': f'Could not resolve campus for grade "{grade_name}". Please provide the explicit "classroom" name or correct "campus" name to clarify which campus this grade belongs to.'})
                continue

            # Quota check
            if org:
                current_count = Student.objects.filter(organization=org).count()
                if current_count >= org.max_students:
                    reports.append({'row': row_num, 'status': 'error', 'name': name,
                                    'message': 'Student quota exceeded. Upgrade your plan to enroll more students.'})
                    continue
                with transaction.atomic():
                    student = Student(
                        name=name,
                        student_id=student_id_val,
                        classroom=assigned_classroom,
                        gender=gender,
                        dob=dob,
                        religion=(row.get('religion') or 'Islam').strip(),
                        mother_tongue=(row.get('mother_tongue') or 'Urdu').strip(),
                        emergency_contact=(row.get('emergency_contact') or '').strip(),
                        address=(row.get('address') or '').strip(),
                        siblings_count=int((row.get('siblings_count') or '0').strip()),
                        current_grade=grade_name,
                        section=section,
                        shift=shift,
                        enrollment_year=admission_year,
                        campus=campus,
                        organization=org,
                        is_draft=False,
                        # optional
                        email=opt('email'),
                        phone_number=opt('phone_number'),
                        father_name=opt('father_name'),
                        father_contact=opt('father_contact'),
                        mother_name=opt('mother_name'),
                        mother_contact=opt('mother_contact'),
                        guardian_name=opt('guardian_name'),
                        guardian_contact=opt('guardian_contact'),
                        blood_group=opt('blood_group'),
                        student_cnic=opt('student_cnic'),
                        nationality=opt('nationality'),
                        place_of_birth=opt('place_of_birth'),
                        father_cnic=opt('father_cnic'),
                        mother_cnic=opt('mother_cnic'),
                        guardian_cnic=opt('guardian_cnic'),
                        emergency_relationship=opt('emergency_relationship'),
                    )
                    student._actor = user
                    student.save()

                    # Auto-create user account
                    _ensure_student_user_account(student)

                reports.append({'row': row_num, 'status': 'ok', 'name': name,
                                'message': f'Student created successfully (ID: {student.student_id or student.id})'})

        except Exception as e:
            msg = str(e)
            # Extract human-readable part from Django ValidationError dict
            if hasattr(e, 'message_dict'):
                parts = []
                for field, errs in e.message_dict.items():
                    parts.append(f'{field}: {", ".join(errs)}')
                msg = '; '.join(parts)
            elif hasattr(e, 'messages'):
                msg = '; '.join(e.messages)
            reports.append({'row': row_num, 'status': 'error', 'name': name, 'message': msg})


    return reports


def _ensure_student_user_account(student):
    if not student.student_id:
        return
    from users.models import User
    actual_email = student.email if student.email else f"{student.student_id}@student.portal"
    if User.objects.filter(username=student.student_id).exists():
        return
    if User.objects.filter(email__iexact=actual_email).exists():
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
    except Exception as e:
        print(f"[BULK STUDENT USER] Could not create user for {student.student_id}: {e}")
