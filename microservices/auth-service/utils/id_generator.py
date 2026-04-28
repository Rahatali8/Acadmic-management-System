from django.db import transaction
from django.utils import timezone


class IDGenerator:
    """
    Centralized ID generator for all user roles and entities.

    Formats:
        Super Admin  : S-YY-XXXX       e.g. S-26-0001
        Admin        : A-YY-XXXX       e.g. A-26-0001
        Org Admin    : OA-YY-XXXX      e.g. OA-26-0001
        Employee     : C01-M-YY-T-XXXX e.g. C01-M-26-T-0042
        Student      : C01-M-YY-XXXXX  e.g. C01-M-26-00456
    """

    ROLE_CODES = {
        'teacher':              'T',
        'coordinator':          'C',
        'principal':            'P',
        'accounts_officer':     'AO',
        'admissions_counselor': 'AC',
        'compliance_officer':   'CO',
        'student':              'ST',
    }

    @classmethod
    def _year_short(cls):
        return str(timezone.now().year)[-2:]

    @classmethod
    def _next_counter(cls, key, organization=None):
        from services.models import GlobalCounter
        with transaction.atomic():
            # Always filter by organization explicitly (including None) to avoid
            # PostgreSQL NULL != NULL uniqueness issue with OrganizationManager.
            counter, _ = GlobalCounter.objects.select_for_update().get_or_create(
                key=key, organization=organization,
                defaults={'value': 0}
            )
            counter.value += 1
            counter.save(update_fields=['value'])
            return counter.value

    @classmethod
    def generate_superadmin_code(cls):
        n = cls._next_counter('superadmin')
        return f"S-{cls._year_short()}-{n:04d}"

    @classmethod
    def generate_admin_code(cls):
        n = cls._next_counter('admin')
        return f"A-{cls._year_short()}-{n:04d}"

    @classmethod
    def generate_orgadmin_code(cls, organization=None):
        n = cls._next_counter('org_admin', organization)
        return f"OA-{cls._year_short()}-{n:04d}"

    @classmethod
    def generate_unique_employee_code(cls, campus, shift, year, role):
        """
        Generate campus-level employee code.
        Format: {campus_code}-{shift_code}-{YY}-{role_code}-{XXXX}
        Example: C01-M-26-T-0042
        """
        year_short = str(year)[-2:]
        shift_code = cls._get_shift_code(shift)
        role_code = cls.ROLE_CODES.get(role, 'T')
        campus_code = getattr(campus, 'campus_code', 'C00')
        organization = getattr(campus, 'organization', None)

        counter_key = f'employee_{campus_code}_{role}'
        n = cls._next_counter(counter_key, organization)
        return f"{campus_code}-{shift_code}-{year_short}-{role_code}-{n:04d}"

    @classmethod
    def generate_student_id(cls, campus, shift, enrollment_year):
        """
        Generate student ID.
        Format: {campus_code}-{shift_code}-{YY}-{XXXXX}
        Example: C01-M-26-00456
        """
        year_short = str(enrollment_year)[-2:]
        shift_code = cls._get_shift_code(shift)
        campus_code = getattr(campus, 'campus_code', 'C00')
        organization = getattr(campus, 'organization', None)

        counter_key = f'student_org_{getattr(organization, "id", 0)}'
        n = cls._next_counter(counter_key, organization)
        return f"{campus_code}-{shift_code}-{year_short}-{n:05d}"

    @staticmethod
    def _get_shift_code(shift):
        return {
            'morning':   'M',
            'Morning':   'M',
            'afternoon': 'A',
            'Afternoon': 'A',
            'both':      'M',
            'Both':      'M',
        }.get(shift, 'M')
