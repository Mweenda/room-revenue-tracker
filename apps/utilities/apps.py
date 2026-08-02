"""Utilities application configuration."""

from django.apps import AppConfig


class UtilitiesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.utilities"
    label = "utilities"

    def ready(self):
        import apps.utilities.signals  # noqa: F401
