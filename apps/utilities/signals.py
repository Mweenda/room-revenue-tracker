"""Utility signals."""

from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.utilities.models import MeterReading
from apps.utilities.services import calculate_utility_split


@receiver(post_save, sender=MeterReading)
def create_utility_bills(sender, instance: MeterReading, created: bool, **kwargs):
    if created:
        calculate_utility_split(instance)
