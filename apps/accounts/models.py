"""Custom user model and authentication."""

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _


class User(AbstractUser):
    """Custom user with role-based access for property management."""

    OWNER = "owner"
    TENANT = "tenant"
    STAFF = "staff"

    ROLE_CHOICES = [
        (OWNER, _("Owner")),
        (TENANT, _("Tenant")),
        (STAFF, _("Staff")),
    ]

    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default=TENANT)
    phone = models.CharField(max_length=20, unique=True)
    block = models.ForeignKey(
        "properties.Block",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="users",
    )

    class Meta:
        verbose_name = _("user")
        verbose_name_plural = _("users")

    def __str__(self) -> str:
        return self.get_full_name() or self.username
