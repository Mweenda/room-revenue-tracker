"""Image upload sanitisation — re-save through Pillow to strip metadata."""

from __future__ import annotations

import io
import logging

from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.utils.translation import gettext_lazy as _
from PIL import Image, UnidentifiedImageError

logger = logging.getLogger(__name__)

ALLOWED_FORMATS = {"JPEG", "PNG"}


def sanitize_image_upload(uploaded_file, max_bytes: int = 5 * 1024 * 1024):
    """Validate MIME/format and re-encode image to strip embedded metadata."""
    if uploaded_file.size > max_bytes:
        raise ValidationError(_("File too large. Maximum size is 5MB."))

    try:
        uploaded_file.seek(0)
        image = Image.open(uploaded_file)
        image.load()
    except UnidentifiedImageError as exc:
        raise ValidationError(_("Invalid image file.")) from exc

    if image.format not in ALLOWED_FORMATS:
        raise ValidationError(_("Only JPEG and PNG images are allowed."))

    output = io.BytesIO()
    fmt = "JPEG" if image.format == "JPEG" else "PNG"
    if fmt == "JPEG" and image.mode not in ("RGB", "L"):
        image = image.convert("RGB")
    image.save(output, format=fmt)
    output.seek(0)
    name = uploaded_file.name.rsplit(".", 1)[0]
    ext = "jpg" if fmt == "JPEG" else "png"
    return ContentFile(output.read(), name=f"{name}.{ext}")
