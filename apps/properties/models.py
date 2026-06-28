"""Block, room, and bed space models."""

from django.db import models
from django.utils.translation import gettext_lazy as _


class Block(models.Model):
    """Property block (BBH, NWG, ANX, CRV)."""

    name = models.CharField(max_length=10)
    code = models.CharField(max_length=5, unique=True)

    class Meta:
        ordering = ["code"]

    def __str__(self) -> str:
        return self.name


class Room(models.Model):
    """Room within a block."""

    block = models.ForeignKey(Block, on_delete=models.CASCADE, related_name="rooms")
    number = models.CharField(max_length=10)
    capacity = models.PositiveSmallIntegerField(default=2)

    class Meta:
        ordering = ["block", "number"]
        unique_together = [("block", "number")]

    def __str__(self) -> str:
        return f"{self.block.code}-{self.number}"


class BedSpace(models.Model):
    """Individual bed space within a room."""

    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name="bed_spaces")
    label = models.CharField(max_length=1)
    identifier = models.CharField(max_length=20, unique=True, editable=False)
    is_occupied = models.BooleanField(default=False)

    class Meta:
        ordering = ["identifier"]
        unique_together = [("room", "label")]

    def __str__(self) -> str:
        return self.identifier or f"{self.room}-{self.label}"

    def save(self, *args, **kwargs):
        if self.room_id:
            self.identifier = (
                f"{self.room.block.code}-{self.room.number}-{self.label}"
            )
        super().save(*args, **kwargs)
