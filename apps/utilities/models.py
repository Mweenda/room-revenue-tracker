"""Utility tracking models."""

from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _


class SystemConfig(models.Model):
    """Singleton-style system configuration."""

    owner_utility_cap_per_tenant = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=Decimal("70.00"),
    )

    class Meta:
        verbose_name = _("System Configuration")
        verbose_name_plural = _("System Configuration")

    def __str__(self) -> str:
        return f"Utility cap K{self.owner_utility_cap_per_tenant}"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def get_solo(cls) -> "SystemConfig":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class MeterReading(models.Model):
    """Prepaid meter reading for a block."""

    block = models.ForeignKey(
        "properties.Block",
        on_delete=models.CASCADE,
        related_name="meter_readings",
    )
    reading_date = models.DateField()
    units_used = models.DecimalField(max_digits=8, decimal_places=2)
    cost_per_unit = models.DecimalField(max_digits=6, decimal_places=2)
    total_cost = models.DecimalField(max_digits=10, decimal_places=2, editable=False)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="meter_readings",
    )

    class Meta:
        ordering = ["-reading_date", "-id"]

    def __str__(self) -> str:
        return f"{self.block.code} {self.reading_date} — K{self.total_cost}"

    def save(self, *args, **kwargs):
        self.total_cost = (self.units_used or Decimal("0")) * (
            self.cost_per_unit or Decimal("0")
        )
        super().save(*args, **kwargs)


class UtilityBill(models.Model):
    """Per-tenant share of a meter reading."""

    meter_reading = models.ForeignKey(
        MeterReading,
        on_delete=models.CASCADE,
        related_name="bills",
    )
    tenant = models.ForeignKey(
        "tenants.TenantProfile",
        on_delete=models.CASCADE,
        related_name="utility_bills",
    )
    owner_share = models.DecimalField(max_digits=6, decimal_places=2)
    tenant_excess = models.DecimalField(max_digits=6, decimal_places=2)
    is_paid = models.BooleanField(default=False)

    class Meta:
        unique_together = [("meter_reading", "tenant")]
        ordering = ["-meter_reading__reading_date"]

    def __str__(self) -> str:
        return f"{self.tenant} excess K{self.tenant_excess}"
