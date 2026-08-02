"""Maintenance issue models."""

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator
from django.db import models
from django.utils.translation import gettext_lazy as _


def validate_issue_photo_size(image):
    limit = 5 * 1024 * 1024
    if hasattr(image, "size") and image.size > limit:
        raise ValidationError(_("File too large. Maximum size is 5MB."))


class MaintenanceIssue(models.Model):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"

    STATUS_CHOICES = [
        (OPEN, _("Open")),
        (IN_PROGRESS, _("In Progress")),
        (RESOLVED, _("Resolved")),
        (CLOSED, _("Closed")),
    ]

    PLUMBING = "plumbing"
    ELECTRICAL = "electrical"
    STRUCTURAL = "structural"
    APPLIANCE = "appliance"
    OTHER = "other"

    CATEGORY_CHOICES = [
        (PLUMBING, _("Plumbing")),
        (ELECTRICAL, _("Electrical")),
        (STRUCTURAL, _("Structural")),
        (APPLIANCE, _("Appliance")),
        (OTHER, _("Other")),
    ]

    bed_space = models.ForeignKey(
        "properties.BedSpace",
        on_delete=models.PROTECT,
        related_name="maintenance_issues",
    )
    reported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="reported_issues",
    )
    category = models.CharField(max_length=15, choices=CATEGORY_CHOICES)
    title = models.CharField(max_length=100)
    description = models.TextField()
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default=OPEN)
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolution_note = models.TextField(blank=True)
    follow_up = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "bed_space"]),
        ]

    def __str__(self) -> str:
        return f"{self.title} ({self.get_status_display()})"

    def update_status(self, status: str, note: str = ""):
        from django.utils import timezone

        self.status = status
        if note:
            self.resolution_note = note
        if status == self.RESOLVED and not self.resolved_at:
            self.resolved_at = timezone.now()
        self.save()


class IssuePhoto(models.Model):
    issue = models.ForeignKey(
        MaintenanceIssue,
        on_delete=models.CASCADE,
        related_name="photos",
    )
    image = models.ImageField(
        upload_to="maintenance/%Y/%m/",
        validators=[
            FileExtensionValidator(allowed_extensions=["jpg", "jpeg", "png"]),
            validate_issue_photo_size,
        ],
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"Photo for {self.issue_id}"


class IssueComment(models.Model):
    """Follow-up comment — tenants cannot edit issues after submission."""

    issue = models.ForeignKey(
        MaintenanceIssue,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
    )
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
