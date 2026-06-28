"""Pytest configuration and shared fixtures."""

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from factory.django import DjangoModelFactory
from factory import SubFactory, Sequence

from apps.accounts.models import User
from apps.properties.models import BedSpace, Block, Room

User = get_user_model()


class UserFactory(DjangoModelFactory):
    class Meta:
        model = User
    username = Sequence(lambda n: f"user_{n}")
    email = Sequence(lambda n: f"user_{n}@example.com")
    first_name = Sequence(lambda n: f"First_{n}")
    last_name = Sequence(lambda n: f"Last_{n}")
    phone = Sequence(lambda n: f"+26097100000{n}")
    role = User.TENANT


class BlockFactory(DjangoModelFactory):
    class Meta:
        model = Block
    name = Sequence(lambda n: f"Block {n}")
    code = Sequence(lambda n: f"B{n}")


class RoomFactory(DjangoModelFactory):
    class Meta:
        model = Room
    block = SubFactory(BlockFactory)
    number = Sequence(lambda n: f"{n}")
    capacity = 2


class BedSpaceFactory(DjangoModelFactory):
    class Meta:
        model = BedSpace
    room = SubFactory(RoomFactory)
    label = Sequence(lambda n: chr(65 + (n % 4)))


class TenantProfileFactory(DjangoModelFactory):
    class Meta:
        model = "tenants.TenantProfile"
    user = SubFactory(UserFactory)
    bed_space = SubFactory(BedSpaceFactory)
    move_in_date = "2026-06-01"
    rent_amount = 1500.00
    nrc_number = Sequence(lambda n: f"{n:09d}ZM")
    emergency_contact = "0977123456"


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


@pytest.fixture
def user_factory():
    return UserFactory


@pytest.fixture
def room_factory():
    return RoomFactory


@pytest.fixture
def bed_space_factory():
    return BedSpaceFactory


@pytest.fixture
def tenant_profile_factory():
    return TenantProfileFactory
