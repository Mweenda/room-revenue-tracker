"""Tests for utilities subsystem."""

from decimal import Decimal

import pytest

from apps.properties.models import Block
from apps.tenants.models import TenantProfile
from apps.utilities.models import MeterReading, SystemConfig, UtilityBill
from apps.utilities.services import calculate_utility_split, calculate_utility_split_amounts


@pytest.mark.django_db
class TestUtilitySplit:

    def test_high_cost_splits_excess(self):
        split = calculate_utility_split_amounts(
            total_cost=Decimal("900"),
            tenant_count=10,
            cap_per_tenant=Decimal("70"),
        )
        assert split.owner_contribution == Decimal("700.00")
        assert split.excess == Decimal("200.00")
        assert split.per_tenant_excess == Decimal("20.00")

    def test_low_cost_owner_covers_all(self):
        split = calculate_utility_split_amounts(
            total_cost=Decimal("200"),
            tenant_count=5,
            cap_per_tenant=Decimal("70"),
        )
        assert split.owner_contribution == Decimal("200.00")
        assert split.excess == Decimal("0")
        assert split.per_tenant_excess == Decimal("0")

    def test_configurable_cap(self, user_factory, block_factory, room_factory, bed_space_factory, tenant_profile_factory):
        SystemConfig.objects.update_or_create(
            pk=1,
            defaults={"owner_utility_cap_per_tenant": Decimal("80.00")},
        )
        block = block_factory(code="NWG", name="NWG")
        bed = bed_space_factory(room=room_factory(block=block, number="01", capacity=2), label="A")
        tenant_profile_factory(bed_space=bed)

        user = user_factory(role="tenant")
        reading = MeterReading.objects.create(
            block=block,
            reading_date="2026-06-01",
            units_used=Decimal("10"),
            cost_per_unit=Decimal("90"),
            recorded_by=user,
        )
        bills = UtilityBill.objects.filter(meter_reading=reading)
        assert bills.count() == 1
        assert bills.first().owner_share == Decimal("80.00")

    def test_post_save_creates_bills_atomically(self, user_factory, block_factory, room_factory, bed_space_factory, tenant_profile_factory):
        block = block_factory(code="ANX", name="ANX")
        room = room_factory(block=block, number="02", capacity=2)
        for label in "AB":
            bed = bed_space_factory(room=room, label=label)
            tenant_profile_factory(bed_space=bed)

        user = user_factory(role="tenant")
        reading = MeterReading.objects.create(
            block=block,
            reading_date="2026-06-15",
            units_used=Decimal("5"),
            cost_per_unit=Decimal("10"),
            recorded_by=user,
        )
        assert UtilityBill.objects.filter(meter_reading=reading).count() == 2


@pytest.mark.django_db
def test_calculate_utility_split_service(block_factory, user_factory):
    block = block_factory(code="CRV", name="CRV")
    user = user_factory(role="tenant")
    reading = MeterReading(
        block=block,
        reading_date="2026-06-01",
        units_used=Decimal("1"),
        cost_per_unit=Decimal("100"),
        recorded_by=user,
    )
    reading.save()
    bills = calculate_utility_split(reading)
    assert isinstance(bills, list)
