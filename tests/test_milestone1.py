"""Milestone 1 acceptance criteria tests."""

import subprocess
from pathlib import Path

import pytest
from django.urls import reverse

from apps.accounts.models import User
from apps.properties.models import BedSpace, Block, Room

REPO_ROOT = Path(__file__).resolve().parent.parent


class TestBedSpaceIdentifier:
    """AC-03: BedSpace identifier auto-generation."""

    def test_identifier_generated_on_save(self, bbh_block):
        room = Room.objects.create(block=bbh_block, number="12", capacity=2)
        bed_space = BedSpace.objects.create(room=room, label="A")

        assert bed_space.identifier == "BBH-12-A"


class TestRoleBasedAccess:
    """AC-02: Role-appropriate dashboard access."""

    def test_owner_login_redirects_to_owner_dashboard(self, client, owner_user):
        response = client.post(
            reverse("account_login"),
            {"login": owner_user.email, "password": "testpass123"},
            follow=True,
        )
        assert response.status_code == 200
        assert response.request["PATH_INFO"] == reverse("core:owner_dashboard")

    def test_tenant_cannot_access_owner_dashboard(self, client, tenant_user):
        client.force_login(tenant_user)
        response = client.get(reverse("core:owner_dashboard"))
        assert response.status_code == 403

    def test_owner_can_access_owner_dashboard(self, client, owner_user):
        client.force_login(owner_user)
        response = client.get(reverse("core:owner_dashboard"))
        assert response.status_code == 200


class TestSecretsNotCommitted:
    """AC-04: No secrets in version control."""

    def test_env_file_is_gitignored(self):
        gitignore = (REPO_ROOT / ".gitignore").read_text()
        assert ".env" in gitignore

    def test_no_env_file_tracked(self):
        result = subprocess.run(
            ["git", "ls-files", ".env"],
            capture_output=True,
            text=True,
            cwd=REPO_ROOT,
        )
        assert result.stdout.strip() == ""

    def test_env_example_has_placeholder_secret(self):
        env_example = (REPO_ROOT / ".env.example").read_text()
        assert "change-me" in env_example.lower() or "SECRET_KEY=" in env_example


class TestAdminAccessible:
    """AC-01: Admin panel is reachable."""

    def test_admin_url_returns_redirect_or_ok(self, client):
        response = client.get("/admin/")
        assert response.status_code in (200, 302)


class TestJWTAuthentication:
    """JWT token endpoints are configured."""

    def test_token_obtain_requires_credentials(self, client, db):
        response = client.post(
            reverse("token_obtain_pair"),
            {"username": "nobody", "password": "wrong"},
            content_type="application/json",
        )
        assert response.status_code == 401

    def test_token_obtain_with_valid_user(self, client, owner_user):
        response = client.post(
            reverse("token_obtain_pair"),
            {"username": owner_user.username, "password": "testpass123"},
            content_type="application/json",
        )
        assert response.status_code == 200
        assert "access" in response.json()
        assert "refresh" in response.json()


class TestRoleGroups:
    """Role groups exist after data migration."""

    def test_role_groups_created(self, role_groups):
        from django.contrib.auth.models import Group

        names = set(Group.objects.values_list("name", flat=True))
        assert {"Owner", "Tenant", "Staff"}.issubset(names)


class TestUserModel:
    """Custom user model configuration."""

    def test_user_has_role_field(self, owner_user):
        assert owner_user.role == User.OWNER

    def test_phone_login_backend(self, owner_user):
        from django.contrib.auth import authenticate

        user = authenticate(username=owner_user.phone, password="testpass123")
        assert user == owner_user
