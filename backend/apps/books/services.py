"""Kitoblar mantiqi: PDF yuklash (sinxron tekshiruv + muqova), nashr, mundarija, o'chirish.

PDF saqlash/multipart mexanizmi `apps.content.pdf_storage` dan qayta ishlatiladi (kalit prefiksi
`book-sources/`); muqova ommaviy `covers` saqlashga tushadi. Fonda ishlov yo'q: yuklash tugashi
bilan kitob `ready`.
"""

import os
import tempfile
import uuid

import structlog
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import transaction

from apps.content import pdf_services as pdf
from apps.content import pdf_storage as storage
from apps.content.admin_services import InvalidTransition, TransitionForbidden, UploadError
from apps.content.storage import covers_storage

from . import pdfmeta
from .models import Book, BookChapter, BookPage, BookStatus

logger = structlog.get_logger(__name__)

SOURCE_PREFIX = "book-sources"
CHAPTERS_MAX = 300


# --- Yuklash ---


def _check_size(size: int) -> None:
    if size > settings.BOOK_PDF_MAX_BYTES:
        raise UploadError("file_too_large", 413)


def begin_upload(book: Book, filename: str, size: int, content_type: str) -> storage.UploadPlan:
    pdf.validate_declared_pdf(filename, size, content_type)
    _check_size(size)
    plan = storage.start_upload(size, SOURCE_PREFIX)
    with transaction.atomic():
        book = Book.objects.select_for_update().get(pk=book.pk)
        old_key, old_upload = book.pending_file, book.pending_upload_id
        book.pending_file, book.pending_upload_id = plan.key, plan.upload_id
        book.save(update_fields=["pending_file", "pending_upload_id", "updated_at"])
    if old_key:  # oldingi tugallanmagan urinish
        storage.abort_upload(old_key, old_upload)
        storage.delete(old_key)
    return plan


def _drop_pending(book: Book, key: str, upload_id: str = "") -> None:
    storage.abort_upload(key, upload_id)
    storage.delete(key)
    Book.objects.filter(pk=book.pk).update(pending_file="", pending_upload_id="")


def wants_auto_cover(book: Book) -> bool:
    """Muqova yo'q yoki avvalgisi avtomatik: PDF'ning 1-betidan olinadi. Qo'lda yuklangan ustun."""
    return not book.cover_image or book.cover_generated


def _optimized_copy(handle, key: str, size: int) -> tuple[str, bool]:
    """PDF'ning optimallashtirilgan nusxasini yangi kalit bilan saqlaydi: `(kalit, bo'ldimi)`.

    Katta (`BOOK_OPTIMIZE_MAX_BYTES`dan ortiq) fayl so'rov vaqtini oshirmasligi uchun qayta
    yozilmaydi. Qayta yozish yoki saqlash muvaffaqiyatsiz bo'lsa asl fayl o'z holicha qoladi.
    """
    if size > settings.BOOK_OPTIMIZE_MAX_BYTES:
        return key, False
    new_key = storage.new_key(SOURCE_PREFIX)
    with tempfile.TemporaryDirectory() as folder:
        path = os.path.join(folder, "optimized.pdf")
        handle.seek(0)
        if not pdfmeta.optimize(handle, path):
            logger.warning("book_optimize_failed", key=key)
            return key, False
        try:
            storage.save_local_file(new_key, path)
        except Exception:  # noqa: BLE001 — saqlash xatosi yuklashni to'xtatmaydi: asl fayl qoladi
            logger.warning("book_optimize_store_failed", key=key)
            storage.delete(new_key)
            return key, False
        return new_key, True


def activate(book: Book, key: str, upload_id: str = "") -> Book:
    """Saqlangan PDF'ni sinxron tekshiradi (sahifalar soni, matn qatlami, muqova) va biriktiradi.

    Kitob darhol `ready`. Buzuq/shifrlangan/katta PDF rad etiladi va yuklangan fayl o'chiriladi:
    kitobda oldingi fayl o'z holicha qoladi.
    """
    cover_name = ""
    final_key, optimized = key, False
    try:
        if not storage.exists(key):
            raise UploadError("upload_incomplete")
        size = storage.stored_size(key)
        if size <= 0:
            raise UploadError("file_empty")
        _check_size(size)
        if not storage.read_head(key, 8).startswith(storage.PDF_MAGIC):
            raise UploadError("unsupported_type", 415)
        current = Book.objects.get(pk=book.pk)
        with storage.opened(key) as handle:
            info = pdfmeta.inspect_pdf(handle, want_cover=wants_auto_cover(current))
            final_key, optimized = _optimized_copy(handle, key, size)
        if info.cover:
            cover_name = covers_storage().save(
                f"covers/{book.pk}-{uuid.uuid4().hex[:8]}.webp", ContentFile(info.cover)
            )
    except UploadError:
        _drop_pending(book, key, upload_id)
        raise

    with transaction.atomic():
        book = Book.objects.select_for_update().get(pk=book.pk)
        old_key = book.source_file.name if book.source_file else ""
        old_cover = ""
        book.source_file = final_key
        if optimized:
            size = storage.stored_size(final_key)
        book.size_bytes, book.page_count = size, info.page_count
        book.has_text_layer, book.is_optimized = info.has_text_layer, optimized
        book.status, book.status_error = BookStatus.READY, ""
        book.pending_file = book.pending_upload_id = ""
        if cover_name and wants_auto_cover(book):
            old_cover = book.cover_image.name if book.cover_image else ""
            book.cover_image, book.cover_generated = cover_name, True
        elif cover_name:  # yuklash paytida admin muqova qo'ydi: avtomatigi kerak emas
            transaction.on_commit(lambda: storage.delete(cover_name, covers_storage()))
        book.save()
        if old_key and old_key != final_key:
            transaction.on_commit(lambda: storage.delete(old_key))
        if final_key != key:  # asl yuklangan nusxa endi kerak emas
            transaction.on_commit(lambda: storage.delete(key))
        if old_cover:
            transaction.on_commit(lambda: storage.delete(old_cover, covers_storage()))
    return book


def regenerate_cover(book: Book) -> Book:
    """Muqovani PDF'ning 1-betidan sinxron qayta oladi (admin "Avtomatik muqova"ni tanlaganda)."""
    if not book.source_file:
        return book
    try:
        with storage.opened(book.source_file.name) as handle:
            info = pdfmeta.inspect_pdf(handle, want_cover=True)
    except UploadError:
        return book  # buzuq fayl: muqova yo'q holda qoladi (kitobning o'zi o'zgarmaydi)
    if not info.cover:
        return book
    name = covers_storage().save(
        f"covers/{book.pk}-{uuid.uuid4().hex[:8]}.webp", ContentFile(info.cover)
    )
    book.cover_image, book.cover_generated = name, True
    book.save(update_fields=["cover_image", "cover_generated", "updated_at"])
    return book


def complete_direct(book: Book, parts: list[dict]) -> Book:
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


def store_proxy(book: Book, file) -> Book:
    """Lokal (dev) rejim: fayl backend orqali keladi."""
    pdf.validate_declared_pdf(
        file.name or "", file.size, getattr(file, "content_type", "") or storage.PDF_MIME
    )
    _check_size(file.size)
    head = file.read(8)
    file.seek(0)
    if not head.startswith(storage.PDF_MAGIC):
        raise UploadError("unsupported_type", 415)
    key = storage.new_key(SOURCE_PREFIX)
    default_storage.save(key, file)
    return activate(book, key)


def read_url(book: Book) -> dict:
    """PDF o'qish URL'i: S3'da imzolangan GET, lokalda imzolangan backend yo'li (qisqa muddatli)."""
    return storage.key_read_url(
        book.source_file.name, str(book.pk), f"/api/v1/books/{book.pk}/file/"
    )


# --- Nashr ---


def allowed_transitions(role: str, book: Book) -> list[str]:
    """Nashr: tayyor kitobni editor/admin chiqaradi; nashrdan qaytarish — faqat admin."""
    if book.is_published:
        return ["draft"] if role == "admin" else []
    return ["published"] if book.status == BookStatus.READY else []


def transition(book: Book, to: str, actor) -> Book:
    role = getattr(actor, "role", "")
    if to == ("published" if book.is_published else "draft"):
        raise InvalidTransition
    if to == "draft" and role != "admin":
        raise TransitionForbidden
    if to == "published" and book.status != BookStatus.READY:
        raise InvalidTransition
    book.is_published = to == "published"
    book.save()
    return book


# --- Mundarija ---


def chapter_errors(chapters: list[dict], page_count: int) -> list[str]:
    codes: list[str] = []
    if len(chapters) > CHAPTERS_MAX:
        codes.append("chapters_too_many")
    previous = 0
    for row in chapters:
        title = (row.get("title") or "").strip()
        page = row.get("start_page") or 0
        if not title:
            codes.append("chapter_title_required")
        elif len(title) > 200:
            codes.append("chapter_title_too_long")
        if page < 1:
            codes.append("chapter_page_invalid")
        elif page_count and page > page_count:
            codes.append("chapter_page_exceeds")
        elif page < previous:
            codes.append("chapter_page_order")
        previous = max(previous, page)
    return list(dict.fromkeys(codes))


def replace_chapters(book: Book, chapters: list[dict]) -> None:
    BookChapter.objects.filter(book=book).delete()
    BookChapter.objects.bulk_create(
        BookChapter(
            book=book,
            title=row["title"].strip(),
            start_page=row["start_page"],
            order=index,
        )
        for index, row in enumerate(chapters)
    )


# --- O'chirish ---


def delete_book(book: Book) -> None:
    """Qator va saqlashdagi fayllar (PDF, muqova, eski sahifa rasmlari) bir tranzaksiyada.

    Saqlash xatosida `storage_error` (502): tranzaksiya qaytadi, kitob saqlanib qoladi.
    """
    storage.abort_upload(book.pending_file, book.pending_upload_id)
    store = covers_storage()
    page_keys = []
    for page in BookPage.objects.filter(book=book).only("image", "thumbnail"):
        page_keys += [page.image.name, page.thumbnail.name]
    for key in dict.fromkeys(k for k in [book.pending_file, book.source_file.name] if k):
        storage.delete_strict(key)
    for key in dict.fromkeys(k for k in [book.cover_image.name, *page_keys] if k):
        storage.delete_strict(key, store)
    book.delete()
