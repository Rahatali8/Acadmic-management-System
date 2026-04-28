import os
import jwt
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed


SECRET_KEY = os.getenv("JWT_SECRET_KEY", "")


def verify_token(token: str) -> dict:
    """Decode and verify a JWT token. Raises AuthenticationFailed on any error."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise AuthenticationFailed("Token expired.")
    except jwt.InvalidTokenError:
        raise AuthenticationFailed("Invalid token.")


class ServiceJWTAuthentication(BaseAuthentication):
    """
    Stateless JWT authentication for microservices.
    Does NOT hit the database — trusts claims embedded in the token.
    """

    def authenticate(self, request):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return None

        token = auth_header.split(" ", 1)[1]
        payload = verify_token(token)

        user = _TokenUser(payload)
        return (user, token)

    def authenticate_header(self, request):
        return "Bearer"


class _TokenUser:
    """Lightweight user object built from JWT claims — no DB query."""

    def __init__(self, payload: dict):
        self.id = payload.get("user_id")
        self.org_id = payload.get("org_id")
        self.role = payload.get("role")
        self.token_version = payload.get("token_version", 0)
        self.is_authenticated = True
        self.is_active = True
        self.is_anonymous = False
        self.is_staff = payload.get("is_staff", False)
        self.is_superuser = payload.get("is_superuser", False)
        self.organization = None  # not a DB object; use org_id for lookups

    def is_superadmin(self):
        return self.role == "superadmin"

    def is_principal(self):
        return self.role == "principal"

    def is_teacher(self):
        return self.role == "teacher"

    def is_coordinator(self):
        return self.role == "coordinator"

    def has_perm(self, perm, obj=None):
        return self.is_superadmin()

    def has_module_perms(self, app_label):
        return self.is_superadmin()

    def __str__(self):
        return f"TokenUser(id={self.id}, role={self.role})"
