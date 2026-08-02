"""Seed all 42 rooms and bed spaces from the property layout fixture."""

from __future__ import annotations

import json
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.properties.models import BedSpace, Block, Room

LABELS = "ABCDEFGH"


class Command(BaseCommand):
    help = "Create all 42 rooms and bed spaces from fixtures/property_layout.json."

    def handle(self, *args, **options):
        fixture_path = Path(__file__).resolve().parents[4] / "fixtures" / "property_layout.json"
        data = json.loads(fixture_path.read_text())

        room_count = 0
        bed_count = 0

        with transaction.atomic():
            for block_data in data["blocks"]:
                block, _ = Block.objects.get_or_create(
                    code=block_data["code"],
                    defaults={"name": block_data["name"]},
                )
                for room_data in block_data["rooms"]:
                    room, created = Room.objects.get_or_create(
                        block=block,
                        number=room_data["number"],
                        defaults={"capacity": room_data["capacity"]},
                    )
                    if created:
                        room_count += 1
                    capacity = room.capacity
                    for label in LABELS[:capacity]:
                        bed, bed_created = BedSpace.objects.get_or_create(
                            room=room,
                            label=label,
                        )
                        if bed_created:
                            bed_count += 1
                            if not bed.identifier:
                                bed.save()

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded property layout: {Room.objects.count()} rooms, "
                f"{BedSpace.objects.count()} bed spaces "
                f"({room_count} new rooms, {bed_count} new beds)."
            )
        )
