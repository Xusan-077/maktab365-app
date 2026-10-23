"""Bo'lim prezentatsiyalari (PDF slaydlar): yuklash, almashtirish va o'chirish.

Kitob PDF'i bilan bir xil mexanizm (S3 multipart yoki lokal proxy, `activate`gacha `pending_*`),
lekin hajm chegarasi yo'q (faqat texnik: 10 000 bo'lak) va fayl kaliti `pdf-slides/<uuid>.pdf`.
"""

import os

from django.core.files.storage import default_storage
from django.db import transaction
from django.utils import timezone

from . import pdf_storage as storage
from .admin_services import UploadError
from .cache import bump_content_version
from .models import PdfBookChapter
from .pdf_services import validate_declared_pdf

NAME_MAX = 255


def clean_name(name: str) -> str:
    """Fayl nomi ko'rsatish uchun: yo'lsiz va uzunligi cheklangan."""
    return os.path.basename((name or "").replace("\\", "/")).strip()[:NAME_MAX]


def begin_upload(
    chapter: PdfBookChapter, filename: str, size: int, content_type: str
) -> storage.UploadPlan:
    validate_declared_pdf(filename, size, content_type)
    plan = storage.start_upload(size, storage.SLIDES_PREFIX)
    with transaction.atomic():
        chapter = PdfBookChapter.objects.select_for_update().get(pk=chapter.pk)
        old_key, old_upload = chapter.slides_pending_file, chapter.slides_pending_upload_id
        chapter.slides_pending_file, chapter.slides_pending_upload_id = plan.key, plan.upload_id
        chapter.save(update_fields=["slides_pending_file", "slides_pending_upload_id"])
    if old_key:  # oldingi tugallanmagan urinish
        storage.abort_upload(old_key, old_upload)
        storage.delete(old_key)
    return plan


def _drop_pending(chapter: PdfBookChapter, key: str, upload_id: str = "") -> None:
    storage.abort_upload(key, upload_id)
    storage.delete(key)
    PdfBookChapter.objects.filter(pk=chapter.pk).update(
        slides_pending_file="", slides_pending_upload_id=""
    )


def activate(
    chapter: PdfBookChapter, key: str, upload_id: str = "", name: str = ""
) -> PdfBookChapter:
    """Saqlangan faylni tekshirib bo'limga biriktiradi (eski fayl o'chiriladi)."""
    try:
        if not storage.exists(key):
            raise UploadError("upload_incomplete")
        size = storage.stored_size(key)
        if size <= 0:
            raise UploadError("file_empty")
        if not storage.read_head(key, 8).startswith(storage.PDF_MAGIC):
            raise UploadError("unsupported_type", 415)
        pages = storage.count_pages(key)
    except UploadError:
        _drop_pending(chapter, key, upload_id)
        raise

    with transaction.atomic():
        chapter = PdfBookChapter.objects.select_for_update().get(pk=chapter.pk)
        old_key = chapter.slides_file or ""
        chapter.slides_file = key
        chapter.slides_name = clean_name(name)
        chapter.slides_page_count, chapter.slides_size_bytes = pages, size
        chapter.slides_updated_at = timezone.now()
        chapter.slides_pending_file = chapter.slides_pending_upload_id = ""
        chapter.save()
        if old_key and old_key != key:
            transaction.on_commit(lambda: storage.delete(old_key))
    return chapter


def complete_direct(chapter: PdfBookChapter, parts: list[dict], name: str = "") -> PdfBookChapter:
    """S3 multipart'ni yakunlaydi, so'ng `activate`."""
    key, upload_id = chapter.slides_pending_file, chapter.slides_pending_upload_id
    if not key or not upload_id:
        raise UploadError("no_pending_upload", 409)
    try:
        storage.finish_multipart(key, upload_id, parts)
    except UploadError:
        _drop_pending(chapter, key, upload_id)
        raise
    return activate(chapter, key, name=name)


def store_proxy(chapter: PdfBookChapter, file) -> PdfBookChapter:
    """Lokal (dev) rejim: fayl backend orqali keladi."""
    validate_declared_pdf(
        file.name or "", file.size, getattr(file, "content_type", "") or storage.PDF_MIME
    )
    head = file.read(8)
    file.seek(0)
    if not head.startswith(storage.PDF_MAGIC):
        raise UploadError("unsupported_type", 415)
    key = storage.new_key(storage.SLIDES_PREFIX)
    default_storage.save(key, file)
    return activate(chapter, key, name=file.name or "")


def abort(chapter: PdfBookChapter) -> None:
    """Tugallanmagan yuklashni bekor qiladi (joriy prezentatsiyaga tegmaydi)."""
    key, upload_id = chapter.slides_pending_file, chapter.slides_pending_upload_id
    if key:
        _drop_pending(chapter, key, upload_id)


def remove(chapter: PdfBookChapter) -> None:
    """Prezentatsiyani saqlashdan va bo'limdan olib tashlaydi.

    Saqlash xatosida `storage_error` (502) ko'tariladi va bo'lim maydonlari o'zgarmaydi.
    """
    storage.abort_upload(chapter.slides_pending_file, chapter.slides_pending_upload_id)
    for key in dict.fromkeys(k for k in (chapter.slides_file, chapter.slides_pending_file) if k):
        storage.delete_strict(key)
    PdfBookChapter.objects.filter(pk=chapter.pk).update(
        slides_file="",
        slides_name="",
        slides_page_count=0,
        slides_size_bytes=0,
        slides_updated_at=None,
        slides_pending_file="",
        slides_pending_upload_id="",
    )
    transaction.on_commit(bump_content_version)
