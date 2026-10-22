"""PDF darsliklar: yuklash oqimi, nashr oqimi va ko'rinish qoidalari."""

import os

from django.conf import settings
from django.core.files.storage import default_storage
from django.db import transaction
from django.utils import timezone

from . import pdf_storage as storage
from .admin_services import EDITORS, InvalidTransition, TransitionForbidden, UploadError
from .cache import is_staff, show_drafts
from .models import PdfBook, PdfBookStatus

TRANSITIONS: dict[tuple[str, str], tuple[str, ...]] = {
    (PdfBookStatus.DRAFT, PdfBookStatus.PUBLISHED): EDITORS,
    (PdfBookStatus.PUBLISHED, PdfBookStatus.DRAFT): ("admin",),
}


def allowed_transitions(role: str, current: str) -> list[str]:
    return [to for (frm, to), roles in TRANSITIONS.items() if frm == current and role in roles]


def visible_pdf_books(request):
    """Ochiq API'da ko'rinadigan PDF kitoblar: fayli bor va nashr qilingan.

    Staff hammasini ko'radi; `SHOW_DRAFTS_PUBLICLY` yoqilgan bo'lsa draft ham (`unverified`).
    """
    books = PdfBook.objects.select_related("subject").exclude(file="")
    if is_staff(request.user) or show_drafts(request):
        return books
    return books.filter(status=PdfBookStatus.PUBLISHED)


# --- Nashr oqimi ---


@transaction.atomic
def transition_pdf_book(book: PdfBook, to: str, actor) -> PdfBook:
    book = PdfBook.objects.select_for_update().get(pk=book.pk)
    roles = TRANSITIONS.get((book.status, to))
    if roles is None:
        raise InvalidTransition()
    if getattr(actor, "role", None) not in roles:
        raise TransitionForbidden()
    if to == PdfBookStatus.PUBLISHED and (not book.file or book.page_count < 1):
        raise UploadError("no_file")
    book.status = to
    if to == PdfBookStatus.PUBLISHED:
        book.published_at = timezone.now()
    book.save()
    return book


# --- Yuklash ---


def validate_declared(filename: str, size: int, content_type: str) -> None:
    """Yuklashni boshlashdan oldin mijoz aytganlarni tekshiradi (haqiqiy tekshiruv `activate`da)."""
    if os.path.splitext(filename or "")[1].lower() != ".pdf":
        raise UploadError("unsupported_type", 415)
    if (content_type or "").split(";")[0].strip().lower() != storage.PDF_MIME:
        raise UploadError("unsupported_type", 415)
    if size <= 0:
        raise UploadError("file_empty")
    if size > settings.PDF_BOOK_MAX_BYTES:
        raise UploadError("file_too_large", 413)


def begin_upload(book: PdfBook, filename: str, size: int, content_type: str) -> storage.UploadPlan:
    validate_declared(filename, size, content_type)
    plan = storage.start_upload(size)
    with transaction.atomic():
        book = PdfBook.objects.select_for_update().get(pk=book.pk)
        old_key, old_upload = book.pending_file, book.pending_upload_id
        book.pending_file, book.pending_upload_id = plan.key, plan.upload_id
        book.save(update_fields=["pending_file", "pending_upload_id", "updated_at"])
    if old_key:  # oldingi tugallanmagan urinish
        storage.abort_upload(old_key, old_upload)
        storage.delete(old_key)
    return plan


def _drop_pending(book: PdfBook, key: str, upload_id: str = "") -> None:
    storage.abort_upload(key, upload_id)
    storage.delete(key)
    PdfBook.objects.filter(pk=book.pk).update(pending_file="", pending_upload_id="")


def activate(book: PdfBook, key: str, upload_id: str = "") -> PdfBook:
    """Saqlangan faylni tekshirib kitobga biriktiradi (eski fayl o'chiriladi)."""
    try:
        if not storage.exists(key):
            raise UploadError("upload_incomplete")
        size = storage.stored_size(key)
        if size <= 0:
            raise UploadError("file_empty")
        if size > settings.PDF_BOOK_MAX_BYTES:
            raise UploadError("file_too_large", 413)
        if not storage.read_head(key, 8).startswith(storage.PDF_MAGIC):
            raise UploadError("unsupported_type", 415)
        pages = storage.count_pages(key)
    except UploadError:
        _drop_pending(book, key, upload_id)
        raise

    with transaction.atomic():
        book = PdfBook.objects.select_for_update().get(pk=book.pk)
        old_key = book.file.name if book.file else ""
        book.file = key
        book.size_bytes, book.page_count = size, pages
        book.pending_file = book.pending_upload_id = ""
        book.save()
        if old_key and old_key != key:
            transaction.on_commit(lambda: storage.delete(old_key))
    return book


def complete_direct(book: PdfBook, parts: list[dict]) -> PdfBook:
    """S3 multipart'ni yakunlaydi, so'ng `activate`."""
    key, upload_id = book.pending_file, book.pending_upload_id
    if not key or not upload_id:
        raise UploadError("no_pending_upload", 409)
    try:
        storage.finish_multipart(key, upload_id, parts)
    except UploadError:
        _drop_pending(book, key, upload_id)
        raise
    return activate(book, key)


def store_proxy(book: PdfBook, file) -> PdfBook:
    """Lokal (dev) rejim: fayl backend orqali keladi."""
    validate_declared(
        file.name or "", file.size, getattr(file, "content_type", "") or storage.PDF_MIME
    )
    head = file.read(8)
    file.seek(0)
    if not head.startswith(storage.PDF_MAGIC):
        raise UploadError("unsupported_type", 415)
    key = storage.new_key()
    default_storage.save(key, file)
    return activate(book, key)


def purge_files(*keys: str) -> None:
    for key in keys:
        storage.delete(key)
