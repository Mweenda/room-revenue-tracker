"""Tests for dashboards, reports, and production readiness."""

from decimal import Decimal
from io import BytesIO

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from PIL import Image

from apps.revenue.models import PaymentRecord


def _proof():
    buf = BytesIO()
    Image.new("RGB", (5, 5), color="green").save(buf, format="JPEG")
    buf.seek(0)
    return SimpleUploadedFile("p.jpg", buf.read(), content_type="image/jpeg")


@pytest.mark.django_db
class TestDashboardsAndReports:

    def test_owner_dashboard_shows_revenue_progress(self, client, owner_user, tenant_profile_factory):
        profile = tenant_profile_factory(rent_amount=Decimal("1000.00"))
        PaymentRecord.objects.create(
            tenant=profile,
            bed_space=profile.bed_space,
            amount=Decimal("750.00"),
            payment_method="airtel",
            transaction_ref="TXNDASH1",
            proof_image=_proof(),
            status=PaymentRecord.VERIFIED,
        )
        client.force_login(owner_user)
        response = client.get(reverse("core:owner_dashboard"))
        assert response.status_code == 200
        content = response.content.decode()
        assert "750" in content or "Verified" in content

    def test_tenant_portal_shows_all_sections(self, client, tenant_profile_factory):
        profile = tenant_profile_factory()
        client.force_login(profile.user)
        response = client.get(reverse("tenants:portal"))
        content = response.content.decode()
        assert profile.bed_space.identifier in content
        assert "Submit Payment" in content
        assert "Report Issue" in content

    def test_ledger_csv_export(self, client, owner_user, tenant_profile_factory):
        profile = tenant_profile_factory()
        PaymentRecord.objects.create(
            tenant=profile,
            bed_space=profile.bed_space,
            amount=Decimal("500.00"),
            payment_method="mtn",
            transaction_ref="TXNCSV1",
            proof_image=_proof(),
        )
        client.force_login(owner_user)
        response = client.get(reverse("reports:export_ledger"))
        assert response.status_code == 200
        assert "text/csv" in response["Content-Type"]
        body = b"".join(response.streaming_content).decode()
        assert "TXNCSV1" in body

    def test_health_check(self, client):
        response = client.get("/health/")
        assert response.status_code == 200
        assert response.json()["database"] == "up"

    def test_occupancy_dashboard_accessible(self, client, owner_user):
        client.force_login(owner_user)
        response = client.get(reverse("properties:occupancy"))
        assert response.status_code == 200
