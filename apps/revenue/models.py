"""Revenue models — payment ledger and verification."""

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator
from django.db import models
from django.utils.translation import gettext_lazy as _


def validate_proof_size(image):
    limit = 5 * 1024 * 1024
    if hasattr(image, "size") and image.size > limit:
        raise ValidationError(_("File too large. Maximum size is 5MB."))


class PaymentRecord(models.Model):
    """Payment record with proof verification."""

    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"

    STATUS_CHOICES = [
        (PENDING, _("Pending")),
        (VERIFIED, _("Verified")),
        (REJECTED, _("Rejected")),
    ]

    AIRTEL = "airtel"
    MTN = "mtn"
    METHOD_CHOICES = [
        (AIRTEL, _("Airtel")),
        (MTN, _("MTN")),
    ]

    tenant = models.ForeignKey(
        "tenants.TenantProfile",
        on_delete=models.PROTECT,
        related_name="payments",
    )
    bed_space = models.ForeignKey(
        "properties.BedSpace",
        on_delete=models.PROTECT,
        related_name="payments",
    )
    amount = models.DecimalField(max_digits=8, decimal_places=2)
    payment_method = models.CharField(max_length=10, choices=METHOD_CHOICES)
    transaction_ref = models.CharField(max_length=50, unique=True)
    proof_image = models.ImageField(
        upload_to="payments/%Y/%m/",
        validators=[
            FileExtensionValidator(allowed_extensions=["jpg", "jpeg", "png"]),
            validate_proof_size,
        ],
    )
    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default=PENDING,
    )
    submitted_at = models.DateTimeField(auto_now_add=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="verified_payments",
    )
    rejection_reason = models.TextField(blank=True)

    class Meta:
        ordering = ["-submitted_at"]
        indexes = [
            models.Index(fields=["status", "submitted_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.transaction_ref} - K{self.amount}"

    def verify(self, user):
        from django.utils import timezone

        self.status = self.VERIFIED
        self.verified_at = timezone.now()
        self.verified_by = user
        self.rejection_reason = ""
        self.save(
            update_fields=[
                "status",
                "verified_at",
                "verified_by",
                "rejection_reason",
            ]
        )

    def reject(self, user, reason: str):
        from django.utils import timezone

        self.status = self.REJECTED
        self.verified_at = timezone.now()
        self.verified_by = user
        self.rejection_reason = reason
        self.save(
            update_fields=[
                "status",
                "verified_at",
                "verified_by",
                "rejection_reason",
            ]
        )
