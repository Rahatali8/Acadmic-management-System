from django.db import models
from django.contrib.auth.models import UserManager
from .middleware import get_current_organization

class MultiTenantUserManager(UserManager):
    """
    Custom manager that supports standard User creation + multi-tenant filtering.
    """
    def get_queryset(self):
        from .middleware import get_current_user
        user = get_current_user()
        org = get_current_organization()
        
        queryset = super().get_queryset()
        
        # If no user or superadmin, don't filter (essential for login)
        if not user or user.is_superadmin():
            return queryset

        # Filter by organization — use org object PK or fall back to JWT org_id claim.
        if hasattr(self.model, 'organization'):
            org_id = getattr(org, 'pk', None) or getattr(user, 'org_id', None)
            if org_id:
                return queryset.filter(organization_id=org_id)

        return queryset

class OrganizationManager(models.Manager):
    """
    Custom manager that automatically filters all queries by the 
    organization of the currently logged-in user (from thread-local storage).
    Superadmins can see all data.
    """
    def get_queryset(self):
        from .middleware import get_current_user, get_current_organization
        user = get_current_user()
        org = get_current_organization()
        
        # Base queryset
        queryset = super().get_queryset()
        
        # If no user, return empty (very secure)
        if not user:
            return queryset.none()

        # Superadmins can see all data
        if user.is_superadmin():
            return queryset
            
        # ─── PARTNER ADMIN LOGIC ───
        if user.role == 'admin':
            if self.model.__name__ == 'Organization':
                # Admins see only organizations they created
                return queryset.filter(created_by=user)

            if hasattr(self.model, 'organization'):
                org_id = getattr(org, 'pk', None) or getattr(user, 'org_id', None)
                if org and hasattr(org, 'created_by'):
                    # org object available — verify ownership
                    if org.created_by_id == user.id:
                        return queryset.filter(organization_id=org_id)
                    return queryset.none()
                elif org_id:
                    return queryset.filter(organization_id=org_id)
                return queryset.filter(organization__created_by=user)

            return queryset

        # ─── ORG ADMIN / STAFF LOGIC ───
        if hasattr(self.model, 'organization'):
            # Prefer org object PK; fall back to org_id from _TokenUser JWT claim.
            # org_id is available when Organization is not in this service's DB
            # (e.g. student-service, campus-service) and the DB lookup returned None.
            org_id = getattr(org, 'pk', None) or getattr(user, 'org_id', None)
            if org_id:
                return queryset.filter(organization_id=org_id)
            else:
                return queryset.filter(organization__isnull=True)

        # Model has no organization field — cannot filter by org, return all
        return queryset
