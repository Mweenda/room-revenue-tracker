"""Test suite for property management and tenant onboarding."""

import json
from io import StringIO

import pytest
from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.urls import reverse

from apps.properties.models import BedSpace, Block, Room
from apps.tenants.models import TenantProfile


@pytest.mark.django_db
class TestTenantOnboardingAndIsolation:

    def test_bed_space_capacity_enforcement(self, room_factory, bed_space_factory, tenant_profile_factory):
        """AC-02: System must reject assigning tenants beyond room capacity."""
        room = room_factory(capacity=2)
        bed_a = bed_space_factory(room=room, label="A")
        bed_b = bed_space_factory(room=room, label="B")

        tenant_profile_factory(bed_space=bed_a)
        tenant_profile_factory(bed_space=bed_b)

        excess_tenant = tenant_profile_factory.build(bed_space=bed_a)
        with pytest.raises(ValidationError) as exc_info:
            excess_tenant.full_clean()
        assert "capacity" in str(exc_info.value).lower()

    def test_tenant_portal_data_isolation(self, client, user_factory, tenant_profile_factory):
        """AC-05: Tenants must only see their own contract details."""
        tenant_1 = user_factory(role="tenant")
        profile_1 = tenant_profile_factory(user=tenant_1)

        tenant_2 = user_factory(role="tenant")
        tenant_profile_factory(user=tenant_2)

        client.force_login(tenant_1)
        response = client.get(reverse("tenants:portal"))

        assert response.status_code == 200
        assert profile_1.bed_space.identifier in response.content.decode()
        assert tenant_2.get_full_name() not in response.content.decode()

    def test_onboarding_sets_bed_occupied(self, client, owner_user, bed_space_factory):
        bed = bed_space_factory(is_occupied=False)
        client.force_login(owner_user)
        response = client.post(
            reverse("tenants:onboard"),
            {
                "first_name": "Jane",
                "last_name": "Doe",
                "email": "jane@example.com",
                "phone": "+260971000099",
                "nrc_number": "123456789",
                "emergency_contact": "0977000000",
                "bed_space": bed.pk,
                "move_in_date": "2026-06-01",
                "rent_amount": "1500.00",
            },
        )
        assert response.status_code == 302
        bed.refresh_from_db()
        assert bed.is_occupied is True
        assert TenantProfile.objects.filter(bed_space=bed).exists()


@pytest.mark.django_db
class TestSeedProperty:

    def test_seed_property_creates_42_rooms(self):
        out = StringIO()
        call_command("seed_property", stdout=out)
        assert Room.objects.count() == 42
        assert Block.objects.count() == 4
        assert BedSpace.objects.filter(identifier__regex=r"^[A-Z]{3}-\d{2}-[A-D]$").count() >= 42

    def test_bed_space_identifier_pattern(self, bbh_block):
        room = Room.objects.create(block=bbh_block, number="12", capacity=2)
        bed = BedSpace.objects.create(room=room, label="A")
        assert bed.identifier == "BBH-12-A"
