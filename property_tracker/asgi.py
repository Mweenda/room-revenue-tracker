"""ASGI config for property_tracker project."""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault(
    "DJANGO_SETTINGS_MODULE",
    "property_tracker.settings.development",
)

application = get_asgi_application()
