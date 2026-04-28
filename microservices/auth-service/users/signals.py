from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from .models import User, Organization, RolePermission


@receiver(post_delete, sender=User)
def cleanup_role_entities_on_user_delete(sender, instance: User, **kwargs):
    """When an auth user is removed, also remove role entity rows that reference the same email/employee code.
    This keeps duplicate checks accurate with current data only.
    """
    try:
        # Coordinator by email or employee_code
        from coordinator.models import Coordinator
        if instance.email:
            Coordinator.objects.filter(email__iexact=instance.email).delete()
        Coordinator.objects.filter(employee_code=instance.username).delete()
    except Exception:
        pass
    try:
        # Principal by email or employee_code
        from principals.models import Principal
        if instance.email:
            Principal.objects.filter(email__iexact=instance.email).delete()
        Principal.objects.filter(employee_code=instance.username).delete()
    except Exception:
        pass
    try:
        # Teacher by email or employee_code
        from teachers.models import Teacher
        if instance.email:
            Teacher.objects.filter(email__iexact=instance.email).delete()
        Teacher.objects.filter(employee_code=instance.username).delete()
    except Exception:
        pass


@receiver(post_save, sender=Organization)
def seed_default_permissions_for_org(sender, instance, created, **kwargs):
    """
    Jab nai Organization create ho, automatically DEFAULT_PERMISSIONS se
    sab roles ki permissions seed kar do — manually command chalane ki zaroorat nahi.
    """
    if not created:
        return

    # 1. Default features set karo agar empty hain
    if not instance.enabled_features:
        instance.enabled_features = {
            "management": True,
            "students": True,
            "attendance": True,
            "academic": True,
            "analytics": True,
            "administration": True
        }
        instance.save(update_fields=['enabled_features'])

    # 2. DEFAULT_PERMISSIONS se sab roles ki permissions seed karo
    from users.management.commands.seed_permissions import DEFAULT_PERMISSIONS

    for role, permissions in DEFAULT_PERMISSIONS.items():
        for codename, is_allowed in permissions.items():
            RolePermission.objects.get_or_create(
                organization=instance,
                role=role,
                permission_codename=codename,
                defaults={'is_allowed': is_allowed}
            )
