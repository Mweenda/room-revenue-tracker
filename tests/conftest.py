"""Pytest configuration and shared fixtures."""

import pytest
from django.contrib.auth.models import Group

from apps.accounts.models import User
from apps.properties.models import BedSpace, Block, Room


@pytest.fixture
def owner_user(db):
    user = User.objects.create_user(
        username="owner1",
        email="owner@example.com",
        password="testpass123",
        phone="+260971000001",
        role=User.OWNER,
    )
    return user


@pytest.fixture
def tenant_user(db):
    user = User.objects.create_user(
        username="tenant1",
        email="tenant@example.com",
        password="testpass123",
        phone="+260971000002",
        role=User.TENANT,
    )
    return user


@pytest.fixture
def staff_user(db):
    user = User.objects.create_user(
        username="staff1",
        email="staff@example.com",
        password="testpass123",
        phone="+260971000003",
        role=User.STAFF,
    )
    return user


@pytest.fixture
def bbh_block(db):
    return Block.objects.create(name="BBH", code="BBH")


@pytest.fixture
def bbh_room_12(bbh_block):
    return Room.objects.create(block=bbh_block, number="12", capacity=2)


@pytest.fixture
def bbh_bed_space_a(bbh_room_12):
    return BedSpace.objects.create(room=bbh_room_12, label="A")


@pytest.fixture
def role_groups(db):
    for name in ("Owner", "Tenant", "Staff"):
        Group.objects.get_or_create(name=name)
