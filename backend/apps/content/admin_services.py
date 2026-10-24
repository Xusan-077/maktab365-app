"""Admin panel mantiqi: xatolar, fayl yuklash (view'lar faqat HTTP)."""

import re
import uuid
from dataclasses import dataclass

from django.conf import settings
from django.core.files.storage import default_storage
from django.utils.text import slugify
from rest_framework import status
from rest_framework.exceptions import APIException

from .storage import covers_storage

# --- Xatolar ---


class InvalidTransition(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "invalid_transition"
    default_detail = "This status change is not allowed."


class TransitionForbidden(APIException):
    status_code = status.HTTP_403_FORBIDDEN
    default_code = "transition_forbidden"
    default_detail = "Your role cannot make this status change."


class UploadError(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "upload_invalid"
    default_detail = "Upload rejected."

    def __init__(self, code: str, http_status: int = 400):
        self.status_code = http_status
        self.default_code = code  # xato formatidagi barqaror `code`
        super().__init__(code, code)


class HasDependents(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_code = "has_dependents"
    default_detail = "Cannot delete: other records depend on this one."


class GradeHasBooks(APIException):
    """Fan sinfdan olib tashlanmoqda, lekin shu sinfda uning kitoblari bor."""

    status_code = status.HTTP_409_CONFLICT
    default_code = "grade_has_books"
    default_detail = "The subject has books in the grades being removed."

    def __init__(self, conflicts: dict[int, int]):
        grades = ", ".join(f"{grade} ({count})" for grade, count in sorted(conflicts.items()))
        super().__init__(f"{self.default_detail} Grades (books): {grades}.")
        # `details.conflicts`: "sinf:soni" — frontend xabarni i18n bilan tuzadi.
        self.details = {"conflicts": [f"{g}:{n}" for g, n in sorted(conflicts.items())]}


EDITORS = ("editor", "admin")


# --- Fayl yuklash ---


@dataclass(frozen=True)
class UploadKind:
    folder: str
    types: tuple[str, ...]
    max_setting: str
    # Ommaviy rasmlar (muqova, rasm) `covers` saqlashga, PDF shaxsiy `default` ga tushadi.
    public: bool = False


KINDS = {
    "cover": UploadKind("covers", ("image/jpeg", "image/png", "image/webp"), "IMAGE", public=True),
    "image": UploadKind("images", ("image/jpeg", "image/png", "image/webp"), "IMAGE", public=True),
    "pdf": UploadKind("pdf", ("application/pdf",), "PDF"),
}
EXTENSIONS = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/pdf": "pdf",
}


def sniff_mime(head: bytes) -> str | None:
    """Kontent boshidagi imzo bo'yicha tur (mijoz aytgan `Content-Type` ga ishonilmaydi)."""
    if head.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "image/webp"
    if head.startswith(b"%PDF-"):
        return "application/pdf"
    return None


def clean_name(original: str, mime: str) -> str:
    """Yo'l/maxsus belgilarsiz xavfsiz nom; kengaytma aniqlangan turdan, noyob qo'shimcha bilan."""
    stem = original.rsplit("/", 1)[-1].rsplit("\\", 1)[-1].rsplit(".", 1)[0]
    stem = re.sub(r"[^a-z0-9-]+", "-", slugify(stem)).strip("-")[:40] or "file"
    return f"{stem}-{uuid.uuid4().hex[:8]}.{EXTENSIONS[mime]}"


def store_upload(file, kind: str) -> dict:
    spec = KINDS.get(kind)
    if spec is None:
        raise UploadError("invalid_kind")
    limit = getattr(settings, f"ADMIN_UPLOAD_MAX_{spec.max_setting}_BYTES")
    if file.size > limit:
        raise UploadError("file_too_large", 413)
    if file.size == 0:
        raise UploadError("file_empty")
    head = file.read(16)
    file.seek(0)
    mime = sniff_mime(head)
    declared = (getattr(file, "content_type", "") or "").split(";")[0].strip().lower()
    if mime not in spec.types or declared != mime:
        raise UploadError("unsupported_type", 415)

    storage = covers_storage() if spec.public else default_storage
    path = storage.save(f"{spec.folder}/{clean_name(file.name or '', mime)}", file)
    return {
        "path": path,
        "url": storage.url(path),
        "name": path.rsplit("/", 1)[-1],
        "size": file.size,
        "content_type": mime,
    }
