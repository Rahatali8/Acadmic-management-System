from django.contrib import admin
from django.contrib.auth.models import Group
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _
from .models import User, Organization, SubscriptionPlan

# Unregister Group model if it is registered
try:
    admin.site.unregister(Group)
except admin.sites.NotRegistered:
    pass



@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ("email",)
    list_display = (
        "email",
        "username",
        "first_name",
        "last_name",
        "role",
        "organization",
        "campus",
        "is_staff",
        "is_superuser",
        "is_active",
    )
    list_filter = ("role", "organization", "is_staff", "is_superuser", "is_active", "campus")
    search_fields = ("email", "username", "first_name", "last_name")

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        (_("Personal info"), {"fields": ("username", "first_name", "last_name", "phone_number")}),
        (
            _("Roles and access"),
            {"fields": ("role", "organization", "campus", "is_active", "is_staff", "is_superuser", "is_verified")},
        ),
        (_("Important dates"), {"fields": ("last_login", "date_joined")}),
    )

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "email",
                    "username",
                    "role",
                    "campus",
                    "password1",
                    "password2",
                    "is_staff",
                    "is_superuser",
                    "is_active",
                ),
            },
        ),
    )

    readonly_fields = ("last_login",)


@admin.register(SubscriptionPlan)
class SubscriptionPlanAdmin(admin.ModelAdmin):
    list_display = ("name", "max_users", "max_students", "max_campuses", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("name",)


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ("name", "subdomain", "plan", "max_users", "max_students", "max_campuses", "is_active", "created_at")
    list_filter = ("plan", "is_active")
    search_fields = ("name", "subdomain")
    raw_id_fields = ("plan",)
