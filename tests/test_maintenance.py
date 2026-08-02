"""Tests for maintenance triage module."""

from io import BytesIO

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from PIL import Image

from apps.maintenance.models import MaintenanceIssue


def _photo(name="p.jpg"):
    buf = BytesIO()
    Image.new("RGB", (8, 8), color="blue").save(buf, format="JPEG")
    buf.seek(0)
    return SimpleUploadedFile(name, buf.read(), content_type="image/jpeg")


@pytest.mark.django_db
class TestMaintenance:

    def test_auto_tags_bed_space(self, client, tenant_profile_factory):
        profile = tenant_profile_factory()
        client.force_login(profile.user)
        response = client.post(
            reverse("maintenance:report"),
            {
                "category": "plumbing",
                "title": "Leaking tap",
                "description": "Kitchen sink leak",
                "photos": [_photo()],
            },
        )
        assert response.status_code == 302
        issue = MaintenanceIssue.objects.get(reported_by=profile.user)
        assert issue.bed_space.identifier == profile.bed_space.identifier

    def test_rejects_more_than_three_photos(self, client, tenant_profile_factory):
        profile = tenant_profile_factory()
        client.force_login(profile.user)
        response = client.post(
            reverse("maintenance:report"),
            {
                "category": "electrical",
                "title": "Socket",
                "description": "Broken socket",
                "photos": [_photo(f"{i}.jpg") for i in range(4)],
            },
        )
        assert response.status_code == 200
        assert "maximum 3 photos" in str(response.context["form"].errors).lower()

    def test_owner_resolves_issue(self, client, owner_user, tenant_profile_factory):
        profile = tenant_profile_factory()
        issue = MaintenanceIssue.objects.create(
            bed_space=profile.bed_space,
            reported_by=profile.user,
            category="plumbing",
            title="Leak",
            description="Water leak",
        )
        client.force_login(owner_user)
        response = client.post(
            reverse("maintenance:update_status", args=[issue.pk]),
            {"status": MaintenanceIssue.RESOLVED, "resolution_note": "Fixed pipe"},
        )
        assert response.status_code == 302
        issue.refresh_from_db()
        assert issue.status == MaintenanceIssue.RESOLVED
        assert issue.resolved_at is not None
        assert issue.resolution_note == "Fixed pipe"

    def test_triage_filter_by_block(self, client, owner_user, tenant_profile_factory, block_factory, room_factory, bed_space_factory):
        block_nwg = block_factory(code="NWG", name="NWG")
        bed = bed_space_factory(room=room_factory(block=block_nwg, number="01"), label="A")
        profile = tenant_profile_factory(bed_space=bed)
        MaintenanceIssue.objects.create(
            bed_space=bed,
            reported_by=profile.user,
            category="plumbing",
            title="NWG leak",
            description="desc",
        )
        client.force_login(owner_user)
        response = client.get(reverse("maintenance:triage"), {"block": "NWG", "category": "plumbing"})
        content = response.content.decode()
        assert "NWG leak" in content

    def test_rejects_oversized_photo(self, client, tenant_profile_factory):
        profile = tenant_profile_factory()
        client.force_login(profile.user)
        big = SimpleUploadedFile("big.jpg", b"x" * (12 * 1024 * 1024), content_type="image/jpeg")
        response = client.post(
            reverse("maintenance:report"),
            {
                "category": "other",
                "title": "Big photo",
                "description": "Too big",
                "photos": [big],
            },
        )
        assert response.status_code == 200
        assert "file too large" in str(response.context["form"].errors).lower()
