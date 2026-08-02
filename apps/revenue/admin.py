"""Revenue admin configuration."""

from django.contrib import admin

from apps.revenue.models import PaymentRecord


@admin.register(PaymentRecord)
class PaymentRecordAdmin(admin.ModelAdmin):
    list_display = (
        "transaction_ref",
        "tenant",
        "bed_space",
        "amount",
        "payment_method",
        "status",
        "submitted_at",
    )
    list_filter = ("status", "payment_method", "bed_space__room__block")
    search_fields = (
        "transaction_ref",
        "tenant__user__username",
        "bed_space__identifier",
    )
    readonly_fields = ("submitted_at", "verified_at")
