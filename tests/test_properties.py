"""Test suite for property management and tenant onboarding."""

import pytest
from django.core.exceptions import ValidationError
from django.urls import reverse
from apps.properties.models import BedSpace


@pytest.mark.django_db
class TestTenantOnboardingAndIsolation:

    def test_bed_space_capacity_enforcement(self, room_factory, bed_space_factory, tenant_profile_factory):
        """AC-02: System must reject assigning tenants beyond room capacity."""
        room = room_factory(capacity=2)
        bed_space = bed_space_factory(room=room, label="A")
        
        tenant_profile_factory.create_batch(2, bed_space=bed_space)
        
        excess_tenant = tenant_profile_factory.build(bed_space=bed_space)
        with pytest.raises(ValidationError) as exc_info:
            excess_tenant.full_clean()
        assert "capacity" in str(exc_info.value).lower()

    def test_tenant_portal_data_isolation(self, client, user_factory, tenant_profile_factory):
        """AC-05: Tenants must only see their own contract details."""
        tenant_1 = user_factory(role='tenant')
        profile_1 = tenant_profile_factory(user=tenant_1)
        
        tenant_2 = user_factory(role='tenant')
        profile_2 = tenant_profile_factory(user=tenant_2)
        
        client.force_login(tenant_1)
        response = client.get(reverse('tenants:portal'))
        
        assert response.status_code == 200
        assert profile_1.bed_space.identifier in response.content.decode()
        assert profile_2.user.get_full_name() not in response.content.decode()
