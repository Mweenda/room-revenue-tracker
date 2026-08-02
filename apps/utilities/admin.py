"""Utilities admin configuration."""

from django.contrib import admin

from apps.utilities.models import MeterReading, SystemConfig, UtilityBill


@admin.register(SystemConfig)
class SystemConfigAdmin(admin.ModelAdmin):
    list_display = ("owner_utility_cap_per_tenant",)

    def has_add_permission(self, request):
        return not SystemConfig.objects.exists()


@admin.register(MeterReading)
class MeterReadingAdmin(admin.ModelAdmin):
    list_display = (
        "block",
        "reading_date",
        "units_used",
        "cost_per_unit",
        "total_cost",
        "recorded_by",
    )
    list_filter = ("block",)
    search_fields = ("block__code",)


@admin.register(UtilityBill)
class UtilityBillAdmin(admin.ModelAdmin):
    list_display = (
        "tenant",
        "meter_reading",
        "owner_share",
        "tenant_excess",
        "is_paid",
    )
    list_filter = ("is_paid", "meter_reading__block")
    search_fields = ("tenant__user__username", "tenant__nrc_number")
