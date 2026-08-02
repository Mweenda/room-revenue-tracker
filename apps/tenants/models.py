"""Tenant onboarding and occupancy models."""

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils.translation import gettext_lazy as _


class TenantProfile(models.Model):
    """Tenant profile with bed space assignment and rental details."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="tenantprofile",
    )
    bed_space = models.ForeignKey(
        "properties.BedSpace",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="tenant_profiles",
    )
    move_in_date = models.DateField()
    move_out_date = models.DateField(null=True, blank=True)
    rent_amount = models.DecimalField(max_digits=8, decimal_places=2)
    nrc_number = models.CharField(max_length=20, unique=True)
    emergency_contact = models.CharField(max_length=100)

    class Meta:
        verbose_name = _("tenant profile")
        verbose_name_plural = _("tenant profiles")

    def __str__(self) -> str:
        return f"{self.user.get_full_name() or self.user.username} - {self.bed_space}"

    @property
    def is_active(self) -> bool:
        return self.move_out_date is None

    def clean(self):
        super().clean()
        if self.bed_space and not self.move_out_date:
            room = self.bed_space.room
            active_occupants = (
                TenantProfile.objects.filter(
                    bed_space__room=room,
                    move_out_date__isnull=True,
                )
                .exclude(pk=self.pk)
                .count()
            )
            if active_occupants >= room.capacity:
                raise ValidationError(
                    _(
                        "Cannot assign tenant. The room capacity (%(capacity)s) "
                        "has been reached."
                    )
                    % {"capacity": room.capacity}
                )

            occupied_same_bed = (
                TenantProfile.objects.filter(
                    bed_space=self.bed_space,
                    move_out_date__isnull=True,
                )
                .exclude(pk=self.pk)
                .exists()
            )
            if occupied_same_bed:
                raise ValidationError(
                    _("This bed space is already assigned to an active tenant.")
                )

    def save(self, *args, **kwargs):
        previous_bed_id = None
        if self.pk:
            previous_bed_id = (
                TenantProfile.objects.filter(pk=self.pk)
                .values_list("bed_space_id", flat=True)
                .first()
            )
        self.full_clean()
        super().save(*args, **kwargs)
        self._sync_occupancy(previous_bed_id)

    def vacate(self, move_out_date):
        """Mark tenant as vacated and free the bed space."""
        bed = self.bed_space
        self.move_out_date = move_out_date
        self.save()
        if bed:
            still_occupied = TenantProfile.objects.filter(
                bed_space=bed,
                move_out_date__isnull=True,
            ).exists()
            if not still_occupied:
                bed.is_occupied = False
                bed.save(update_fields=["is_occupied"])

    def _sync_occupancy(self, previous_bed_id=None):
        from apps.properties.models import BedSpace

        if previous_bed_id and previous_bed_id != getattr(self.bed_space, "id", None):
            previous = BedSpace.objects.filter(pk=previous_bed_id).first()
            if previous:
                still_occupied = TenantProfile.objects.filter(
                    bed_space=previous,
                    move_out_date__isnull=True,
                ).exists()
                previous.is_occupied = still_occupied
                previous.save(update_fields=["is_occupied"])

        if self.bed_space_id:
            self.bed_space.is_occupied = self.move_out_date is None
            self.bed_space.save(update_fields=["is_occupied"])
