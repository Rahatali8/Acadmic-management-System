from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from users.models import User, Organization
from campus.models import Campus
from utils.id_generator import IDGenerator
from services.models import GlobalCounter
import getpass


class Command(BaseCommand):
    help = 'Interactively create any system user'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS("\n=== AMS User Creation ===\n"))

        # 1. First Name
        first_name = self._prompt("First Name")

        # 2. Last Name
        last_name = input("Last Name (optional): ").strip()

        # 3. Role
        roles = {
            '1':  'superadmin',
            '2':  'admin',
            '3':  'org_admin',
            '4':  'principal',
            '5':  'coordinator',
            '6':  'teacher',
            '7':  'accounts_officer',
            '8':  'admissions_counselor',
            '9':  'compliance_officer',
            '10': 'donor',
            '11': 'student',
        }
        labels = {
            '1':  'Super Admin',
            '2':  'Admin',
            '3':  'Organization Admin',
            '4':  'Principal',
            '5':  'Teacher Coordinator',
            '6':  'Teacher',
            '7':  'Accounts Officer',
            '8':  'Admissions Counselor',
            '9':  'Compliance Officer',
            '10': 'Donor',
            '11': 'Student',
        }
        self.stdout.write("\nSelect Role:")
        for k, v in labels.items():
            self.stdout.write(f"  {k:>2}: {v}")

        role_choice = input("\nEnter choice (1-11): ").strip()
        while role_choice not in roles:
            self.stdout.write(self.style.ERROR("Invalid choice. Enter 1-11."))
            role_choice = input("Enter choice (1-11): ").strip()
        role = roles[role_choice]

        # 4. Email
        email = input("Email: ").strip()
        while not email or User.objects.filter(email=email).exists():
            if not email:
                self.stdout.write(self.style.ERROR("Email is required."))
            else:
                self.stdout.write(self.style.ERROR("Email already exists."))
            email = input("Email: ").strip()

        # 5. Organization
        organization = None
        if role not in ['superadmin', 'admin']:
            organization = self._pick_organization()
            if organization is None:
                return

        # 6. Campus (only for campus-level roles)
        campus = None
        campus_roles = ['principal', 'coordinator', 'teacher',
                        'accounts_officer', 'admissions_counselor',
                        'compliance_officer', 'student']
        if role in campus_roles:
            campus = self._pick_campus(organization)
            if campus is None:
                return

        # 7. Generate ID code
        self.stdout.write("\nGenerating code...")
        username = self._generate_code(role, campus, organization)
        if not username:
            return
        self.stdout.write(self.style.SUCCESS(f"Code: {username}"))

        # 8. Password
        password = self._get_password()

        # 9. Create user
        try:
            with transaction.atomic():
                user = User.objects.create_user(
                    username=username,
                    email=email,
                    password=password,
                    first_name=first_name,
                    last_name=last_name,
                    role=role,
                    campus=campus,
                    organization=organization,
                    is_verified=True,
                    has_changed_default_password=True,
                    is_staff=role in ['superadmin', 'admin'],
                    is_superuser=role == 'superadmin',
                )

            self.stdout.write(self.style.SUCCESS("\n" + "=" * 45))
            self.stdout.write(self.style.SUCCESS("User created successfully!"))
            self.stdout.write(self.style.SUCCESS(f"  Name  : {first_name} {last_name}".strip()))
            self.stdout.write(self.style.SUCCESS(f"  Email : {email}"))
            self.stdout.write(self.style.SUCCESS(f"  Code  : {username}"))
            self.stdout.write(self.style.SUCCESS(f"  Role  : {user.get_role_display()}"))
            self.stdout.write(self.style.SUCCESS(f"  Org   : {organization.name if organization else 'System'}"))
            self.stdout.write(self.style.SUCCESS(f"  Campus: {campus.campus_name if campus else 'N/A'}"))
            self.stdout.write(self.style.SUCCESS("=" * 45 + "\n"))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Failed to create user: {e}"))

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _prompt(self, label):
        value = input(f"{label}: ").strip()
        while not value:
            self.stdout.write(self.style.ERROR(f"{label} is required."))
            value = input(f"{label}: ").strip()
        return value

    def _pick_organization(self):
        orgs = list(Organization.objects.all())
        if not orgs:
            self.stdout.write(self.style.ERROR("No organizations found. Create one first."))
            return None
        self.stdout.write("\nSelect Organization:")
        for i, org in enumerate(orgs, 1):
            self.stdout.write(f"  {i}: {org.name}")
        choice = input(f"Enter choice (1-{len(orgs)}): ").strip()
        while not choice.isdigit() or not (1 <= int(choice) <= len(orgs)):
            self.stdout.write(self.style.ERROR("Invalid choice."))
            choice = input(f"Enter choice (1-{len(orgs)}): ").strip()
        return orgs[int(choice) - 1]

    def _pick_campus(self, organization):
        campuses = list(Campus._base_manager.filter(organization=organization) if organization else Campus._base_manager.all())
        if not campuses:
            self.stdout.write(self.style.ERROR("No campuses found for this organization."))
            return None
        self.stdout.write("\nSelect Campus:")
        for i, c in enumerate(campuses, 1):
            self.stdout.write(f"  {i}: {c.campus_name} ({c.campus_code})")
        choice = input(f"Enter choice (1-{len(campuses)}): ").strip()
        while not choice.isdigit() or not (1 <= int(choice) <= len(campuses)):
            self.stdout.write(self.style.ERROR("Invalid choice."))
            choice = input(f"Enter choice (1-{len(campuses)}): ").strip()
        return campuses[int(choice) - 1]

    def _generate_code(self, role, campus, organization):
        current_year = timezone.now().year
        current_year_short = str(current_year)[-2:]
        try:
            with transaction.atomic():
                if role == 'superadmin':
                    return IDGenerator.generate_superadmin_code()
                elif role == 'admin':
                    return IDGenerator.generate_admin_code()
                elif role == 'org_admin':
                    return IDGenerator.generate_orgadmin_code()
                elif role == 'donor':
                    counter, _ = GlobalCounter.objects.select_for_update().get_or_create(
                        key='employee_donor',
                        organization=organization,
                        defaults={'value': 0}
                    )
                    counter.value += 1
                    counter.save(update_fields=['value'])
                    return f"D-{current_year_short}-{counter.value:04d}"
                else:
                    return IDGenerator.generate_unique_employee_code(campus, 'Morning', current_year, role)
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Code generation failed: {e}"))
            return None

    def _get_password(self):
        password = getpass.getpass("Password (min 6 chars): ")
        while len(password) < 6:
            self.stdout.write(self.style.ERROR("Password must be at least 6 characters."))
            password = getpass.getpass("Password: ")
        confirm = getpass.getpass("Confirm Password: ")
        while password != confirm:
            self.stdout.write(self.style.ERROR("Passwords do not match. Try again."))
            password = getpass.getpass("Password: ")
            confirm = getpass.getpass("Confirm Password: ")
        return password
