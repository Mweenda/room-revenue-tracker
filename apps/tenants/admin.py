"""Tenants admin configuration."""

from django.contrib import admin

from apps.tenants.models import TenantProfile


@admin.register(TenantProfile)
class TenantProfileAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "bed_space",
        "move_in_date",
        "move_out_date",
        "rent_amount",
        "nrc_number",
    )
    list_filter = ("move_out_date", "bed_space__room__block")
    search_fields = (
        "user__username",
        "user__first_name",
        "user__last_name",
        "nrc_number",
        "bed_space__identifier",
    )
    autocomplete_fields = ("user", "bed_space")
