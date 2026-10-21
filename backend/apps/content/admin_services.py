"""Admin panel mantiqi: nashr oqimi, tartiblash, fayl yuklash (view'lar faqat HTTP)."""

import re
import uuid
from dataclasses import dataclass

from django.conf import settings
from django.core.files.storage import default_storage
from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import status
from rest_framework.exceptions import APIException, ValidationError

from .cache import bump_content_version
from .models import Chapter, Topic, TopicStatus

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


# --- Nashr oqimi ---

EDITORS = ("editor", "admin")
# (qayerdan, qayerga) -> ruxsat etilgan rollar
TRANSITIONS: dict[tuple[str, str], tuple[str, ...]] = {
    (TopicStatus.DRAFT, TopicStatus.REVIEWED): EDITORS,
    (TopicStatus.REVIEWED, TopicStatus.PUBLISHED): EDITORS,
    (TopicStatus.PUBLISHED, TopicStatus.DRAFT): ("admin",),
}


def allowed_transitions(role: str, current: str) -> list[str]:
    return [to for (frm, to), roles in TRANSITIONS.items() if frm == current and role in roles]


@transaction.atomic
def transition_topic(topic: Topic, to: str, actor) -> Topic:
    """Holatni o'zgartiradi (qoidalar `TRANSITIONS`); kesh `Topic.save()` signalida tozalanadi."""
    topic = Topic.objects.select_for_update().get(pk=topic.pk)
    roles = TRANSITIONS.get((topic.status, to))
    if roles is None:
        raise InvalidTransition()
    if getattr(actor, "role", "") not in roles:
        raise TransitionForbidden()

    now = timezone.now()
    topic.status = to
    if to == TopicStatus.REVIEWED:
        topic.reviewed_by, topic.reviewed_at = actor, now
    elif to == TopicStatus.PUBLISHED:
        topic.published_at = now
    else:  # draft'ga qaytarish: tekshiruv va nashr izlari o'chadi
        topic.reviewed_by = topic.reviewed_at = topic.published_at = None
    topic.save()
    return topic


# --- Tartiblash ---


def _fail(field: str, code: str):
    raise ValidationError({field: [code]})


@transaction.atomic
def reorder_book(book, chapter_ids: list | None, topic_map: dict | None) -> None:
    """Bob va mavzular tartibi bir so'rovda.

    `chapter_ids` — kitobning barcha boblari yangi tartibda. `topic_map` — `{bob_id: [mavzu_id…]}`:
    har bob ro'yxati o'sha bobning to'liq yangi tarkibi (mavzuni boshqa bobga ko'chirish mumkin,
    shunda ikkala bob ham berilishi kerak). Tartib raqami 1 dan.
    """
    chapters = {c.pk: c for c in Chapter.objects.select_for_update().filter(book=book)}

    if chapter_ids is not None:
        if len(set(chapter_ids)) != len(chapter_ids) or set(chapter_ids) != set(chapters):
            _fail("chapters", "must_list_all_chapters")
        for position, pk in enumerate(chapter_ids, start=1):
            chapters[pk].order = position
        Chapter.objects.bulk_update(chapters.values(), ["order"])

    if topic_map:
        topics = {t.pk: t for t in Topic.objects.select_for_update().filter(book=book)}
        if set(topic_map) - set(chapters):
            _fail("topics", "unknown_chapter")
        listed = [pk for ids in topic_map.values() for pk in ids]
        if len(set(listed)) != len(listed) or set(listed) - set(topics):
            _fail("topics", "unknown_or_duplicate_topic")
        # Bobda qolib ro'yxatda yo'q mavzu tartib raqami to'qnashuviga olib keladi.
        orphan = [t for t in topics.values() if t.chapter_id in topic_map and t.pk not in listed]
        if orphan:
            _fail("topics", "must_list_all_topics")
        for chapter_id, ids in topic_map.items():
            for position, pk in enumerate(ids, start=1):
                topics[pk].chapter_id, topics[pk].order = chapter_id, position
        Topic.objects.bulk_update([topics[pk] for pk in listed], ["chapter", "order"])

    # `bulk_update` signal yubormaydi.
    transaction.on_commit(bump_content_version)


def next_order(queryset) -> int:
    return (queryset.aggregate(top=Max("order"))["top"] or 0) + 1


# --- Fayl yuklash ---


@dataclass(frozen=True)
class UploadKind:
    folder: str
    types: tuple[str, ...]
    max_setting: str


KINDS = {
    "cover": UploadKind("covers", ("image/jpeg", "image/png", "image/webp"), "IMAGE"),
    "image": UploadKind("images", ("image/jpeg", "image/png", "image/webp"), "IMAGE"),
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

    path = default_storage.save(f"{spec.folder}/{clean_name(file.name or '', mime)}", file)
    return {
        "path": path,
        "url": default_storage.url(path),
        "name": path.rsplit("/", 1)[-1],
        "size": file.size,
        "content_type": mime,
    }
