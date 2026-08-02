"""Revenue domain services."""

from __future__ import annotations

from decimal import Decimal

from django.db.models import Q, Sum
from django.utils import timezone

from apps.properties.models import Block
from apps.revenue.models import PaymentRecord
from apps.tenants.models import TenantProfile


def monthly_revenue_totals(year: int, month: int) -> dict:
    """Return expected / verified / outstanding for a calendar month."""
    active_tenants = TenantProfile.objects.filter(move_out_date__isnull=True)
    expected = active_tenants.aggregate(total=Sum("rent_amount"))["total"] or Decimal("0")
    verified = (
        PaymentRecord.objects.filter(
            status=PaymentRecord.VERIFIED,
            submitted_at__year=year,
            submitted_at__month=month,
        ).aggregate(total=Sum("amount"))["total"]
        or Decimal("0")
    )
    outstanding = max(expected - verified, Decimal("0"))
    progress = float((verified / expected) * 100) if expected else 0.0
    return {
        "expected_revenue": expected,
        "verified_revenue": verified,
        "outstanding_revenue": outstanding,
        "progress_percent": round(progress, 1),
        "year": year,
        "month": month,
    }


def monthly_block_revenue(year: int, month: int) -> list[dict]:
    """Per-block expected / verified / outstanding breakdown."""
    rows = []
    for block in Block.objects.all():
        expected = (
            TenantProfile.objects.filter(
                move_out_date__isnull=True,
                bed_space__room__block=block,
            ).aggregate(total=Sum("rent_amount"))["total"]
            or Decimal("0")
        )
        verified = (
            PaymentRecord.objects.filter(
                status=PaymentRecord.VERIFIED,
                submitted_at__year=year,
                submitted_at__month=month,
                bed_space__room__block=block,
            ).aggregate(total=Sum("amount"))["total"]
            or Decimal("0")
        )
        pending = (
            PaymentRecord.objects.filter(
                status=PaymentRecord.PENDING,
                submitted_at__year=year,
                submitted_at__month=month,
                bed_space__room__block=block,
            ).aggregate(total=Sum("amount"))["total"]
            or Decimal("0")
        )
        rows.append(
            {
                "block": block,
                "expected": expected,
                "verified": verified,
                "pending": pending,
                "outstanding": max(expected - verified, Decimal("0")),
            }
        )
    return rows


def tenants_needing_payment_reminder(as_of=None) -> list[TenantProfile]:
    """Active tenants with no verified payment for the current month."""
    as_of = as_of or timezone.localdate()
    verified_tenant_ids = PaymentRecord.objects.filter(
        status=PaymentRecord.VERIFIED,
        submitted_at__year=as_of.year,
        submitted_at__month=as_of.month,
    ).values_list("tenant_id", flat=True)
    return list(
        TenantProfile.objects.filter(move_out_date__isnull=True)
        .exclude(pk__in=verified_tenant_ids)
        .select_related("user")
    )
