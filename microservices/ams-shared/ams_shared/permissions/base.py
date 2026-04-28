from rest_framework.permissions import BasePermission


class IsOrganizationMember(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.org_id)


class IsPrincipal(BasePermission):
    def has_permission(self, request, view):
        return getattr(request.user, "role", None) == "principal"


class IsCoordinator(BasePermission):
    def has_permission(self, request, view):
        return getattr(request.user, "role", None) in ("coordinator", "principal")


class IsTeacher(BasePermission):
    def has_permission(self, request, view):
        return getattr(request.user, "role", None) in ("teacher", "coordinator", "principal")


class IsAdminOrSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        return getattr(request.user, "role", None) in ("admin", "superadmin")


class IsInternalService(BasePermission):
    """Allow requests that carry the internal service secret header."""

    def has_permission(self, request, view):
        import os
        expected = os.getenv("INTERNAL_SERVICE_SECRET", "")
        provided = request.headers.get("X-Internal-Secret", "")
        return bool(expected and provided == expected)
