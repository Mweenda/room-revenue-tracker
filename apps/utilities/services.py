"""Pure utility cost-splitting services."""

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import NamedTuple

from django.db import transaction

from apps.tenants.models import TenantProfile
from apps.utilities.models import MeterReading, SystemConfig, UtilityBill


class UtilitySplitResult(NamedTuple):
    owner_contribution: Decimal
    excess: Decimal
    per_tenant_excess: Decimal
    owner_share_per_tenant: Decimal
    tenant_count: int


def calculate_utility_split_amounts(
    total_cost: Decimal,
    tenant_count: int,
    cap_per_tenant: Decimal,
) -> UtilitySplitResult:
    """Pure calculation of utility cost split — no database access.

    Business rules:
    - Owner contributes min(cap × tenants, total_cost)
    - Excess = total_cost − owner contribution, split equally among tenants
    - If total_cost ≤ owner contribution, tenants pay nothing
    """
    total_cost = Decimal(total_cost)
    cap_per_tenant = Decimal(cap_per_tenant)
    n = int(tenant_count)

    if n <= 0:
        return UtilitySplitResult(
            owner_contribution=Decimal("0"),
            excess=Decimal("0"),
            per_tenant_excess=Decimal("0"),
            owner_share_per_tenant=Decimal("0"),
            tenant_count=0,
        )

    max_owner = (cap_per_tenant * n).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    owner_contribution = min(max_owner, total_cost)
    excess = max(total_cost - owner_contribution, Decimal("0"))
    per_tenant_excess = (excess / n).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    owner_share_per_tenant = (owner_contribution / n).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    return UtilitySplitResult(
        owner_contribution=owner_contribution,
        excess=excess,
        per_tenant_excess=per_tenant_excess,
        owner_share_per_tenant=owner_share_per_tenant,
        tenant_count=n,
    )


@transaction.atomic
def calculate_utility_split(meter_reading: MeterReading) -> list[UtilityBill]:
    """Create UtilityBill rows for every active tenant in the block."""
    config = SystemConfig.get_solo()
    tenants = list(
        TenantProfile.objects.filter(
            bed_space__room__block=meter_reading.block,
            move_out_date__isnull=True,
        )
    )
    split = calculate_utility_split_amounts(
        total_cost=meter_reading.total_cost,
        tenant_count=len(tenants),
        cap_per_tenant=config.owner_utility_cap_per_tenant,
    )

    UtilityBill.objects.filter(meter_reading=meter_reading).delete()
    bills: list[UtilityBill] = []
    for tenant in tenants:
        bills.append(
            UtilityBill(
                meter_reading=meter_reading,
                tenant=tenant,
                owner_share=split.owner_share_per_tenant,
                tenant_excess=split.per_tenant_excess,
                is_paid=split.per_tenant_excess == 0,
            )
        )
    return UtilityBill.objects.bulk_create(bills)
