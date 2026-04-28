"""
Organization Tenant Middleware
Automatically filters querysets based on the logged-in user's organization.
Superadmin users bypass this filter.
Supports ASGI/Asyncio by using contextvars instead of threading.local.
"""
from contextvars import ContextVar
from ams_shared.jwt.validator import ServiceJWTAuthentication
from rest_framework.exceptions import AuthenticationFailed

# Context variables to hold the current organization and user.
# These are safer for ASGI/Asyncio (Daphne/Uvicorn) than threading.local.
_organization_var = ContextVar('organization', default=None)
_user_var = ContextVar('user', default=None)


def get_current_organization():
    """Get the current organization from context variables"""
    return _organization_var.get()


def get_current_user():
    """Get the current user from context variables"""
    return _user_var.get()


class OrganizationMiddleware:
    """
    Middleware that sets the current organization on each request.
    This allows models and querysets to automatically filter by organization.
    Uses stateless JWT (ServiceJWTAuthentication) so it works across all
    microservices without requiring the user to exist in the local DB.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Reset context variables for this request/coroutine
        token_org = _organization_var.set(None)
        token_user = _user_var.set(None)

        try:
            user = getattr(request, 'user', None)

            # Stateless JWT auth — works across all microservices without a DB lookup.
            if not user or not user.is_authenticated:
                try:
                    auth = ServiceJWTAuthentication()
                    result = auth.authenticate(request)
                    if result:
                        user = result[0]
                except (AuthenticationFailed, Exception):
                    user = None

            if user and user.is_authenticated:
                # Resolve organization object from org_id claim when the user is
                # a stateless _TokenUser (organization attr is None by default).
                org = getattr(user, 'organization', None)
                if org is None:
                    org_id = getattr(user, 'org_id', None)
                    if org_id:
                        try:
                            from users.models import Organization
                            org = Organization.all_objects.filter(pk=org_id).first()
                        except Exception:
                            org = None

                # Block inactive organizations (bypass for superadmins)
                if org and not org.is_active and not user.is_superadmin():
                    from django.http import JsonResponse
                    return JsonResponse({
                        'error': 'Organization is inactive',
                        'detail': 'Your organization has been deactivated. Please contact the administrator.'
                    }, status=403)

                _user_var.set(user)
                _organization_var.set(org)

            response = self.get_response(request)
            return response

        finally:
            # Clean up context variables after the request
            _organization_var.reset(token_org)
            _user_var.reset(token_user)
