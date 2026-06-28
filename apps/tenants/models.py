"""Tenant models — implemented in Milestone 2."""

from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError


class TenantProfile(models.Model):
    """Tenant profile with bed space assignment and rental details."""

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    bed_space = models.ForeignKey(
        'properties.BedSpace',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='tenant_profiles'
    )
    move_in_date = models.DateField()
    move_out_date = models.DateField(null=True, blank=True)
    rent_amount = models.DecimalField(max_digits=8, decimal_places=2)
    nrc_number = models.CharField(max_length=20, unique=True)
    emergency_contact = models.CharField(max_length=100)

    class Meta:
        verbose_name = "tenant profile"
        verbose_name_plural = "tenant profiles"

    def __str__(self) -> str:
        return f"{self.user.get_full_name()} - {self.bed_space}"

    def clean(self):
        super().clean()
        if self.bed_space and not self.move_out_date:
            room = self.bed_space.room
            active_occupants = TenantProfile.objects.filter(
                bed_space__room=room,
                move_out_date__isnull=True
            ).exclude(pk=self.pk).count()

            if active_occupants >= room.capacity:
                raise ValidationError(
                    f"Cannot assign tenant. The room capacity ({room.capacity}) has been reached."
                )

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
