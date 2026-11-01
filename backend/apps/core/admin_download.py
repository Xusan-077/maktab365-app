"""Faqat admin uchun yuklab olish: PDF (imzolangan `attachment` URL) va muqova (asl fayl)."""

import mimetypes
import re
from urllib.parse import quote

from django.http import HttpResponse
from rest_framework.exceptions import NotFound


def safe_filename(title: str, extension: str, fallback: str = "kitob") -> str:
    stem = re.sub(r'[\/:*?"<>|\s]+', " ", title or "").strip()[:80] or fallback
    return f"{stem}.{extension.lstrip('.')}"


def cover_response(field, title: str) -> HttpResponse:
    """Muqovaning ASL faylini `attachment` qilib qaytaradi (saytda kichik variant)."""
    if not field:
        raise NotFound
    with field.storage.open(field.name, "rb") as handle:
        data = handle.read()
    extension = field.name.rsplit(".", 1)[-1] if "." in field.name else "webp"
    filename = safe_filename(title, extension, "muqova")
    response = HttpResponse(
        data, content_type=mimetypes.guess_type(field.name)[0] or "application/octet-stream"
    )
    ascii_name = re.sub(r"[^A-Za-z0-9._ -]+", "_", filename)
    response["Content-Disposition"] = (
        f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(filename)}"
    )
    response["Cache-Control"] = "private, no-store"
    return response
