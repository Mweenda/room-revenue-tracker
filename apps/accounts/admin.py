"""Accounts admin configuration."""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _

from apps.accounts.models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("username", "email", "phone", "role", "block", "is_staff")
    list_filter = ("role", "is_staff", "is_active")
    search_fields = ("username", "email", "phone", "first_name", "last_name")
    fieldsets = BaseUserAdmin.fieldsets + (
        (_("Role & property"), {"fields": ("role", "phone", "block")}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        (
            _("Role & property"),
            {"fields": ("role", "phone", "block", "email")},
        ),
    )
