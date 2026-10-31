"""Kitoblar mantiqi: PDF yuklash, sahifa rasmlariga aylantirish, nashr, o'chirish.

PDF saqlash/multipart mexanizmi `apps.content.pdf_storage` dan qayta ishlatiladi (kalit prefiksi
`book-sources/`); sahifa rasmlari ommaviy `covers` saqlashga tushadi.
"""

import uuid

import structlog
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import transaction
from pypdfium2 import PdfiumError

from apps.content import pdf_services as pdf
from apps.content import pdf_storage as storage
from apps.content.admin_services import InvalidTransition, TransitionForbidden, UploadError
from apps.content.storage import covers_storage

from . import rasterize
from .models import Book, BookChapter, BookPage, BookStatus

logger = structlog.get_logger(__name__)

SOURCE_PREFIX = "book-sources"
FLUSH_EVERY = 10  # shuncha sahifadan keyin bazaga yoziladi va jarayon ko'rsatkichi yangilanadi
CHAPTERS_MAX = 300


# --- Yuklash ---


def begin_upload(book: Book, filename: str, size: int, content_type: str) -> storage.UploadPlan:
    pdf.validate_declared(filename, size, content_type)
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


def activate(book: Book, key: str, upload_id: str = "") -> Book:
    """Saqlangan PDF'ni tekshirib biriktiradi va sahifalarni fonda tayyorlashni boshlaydi."""
    from .tasks import process_book

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
        _drop_pending(book, key, upload_id)
        raise

    with transaction.atomic():
        book = Book.objects.select_for_update().get(pk=book.pk)
        old_key = book.source_file.name if book.source_file else ""
        book.source_file = key
        book.size_bytes, book.page_count, book.processed_pages = size, pages, 0
        book.status, book.status_error = BookStatus.PROCESSING, ""
        book.pending_file = book.pending_upload_id = ""
        book.save()
        if old_key and old_key != key:
            transaction.on_commit(lambda: storage.delete(old_key))
        transaction.on_commit(lambda: process_book.delay(str(book.pk)))
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
    pdf.validate_declared(
        file.name or "", file.size, getattr(file, "content_type", "") or storage.PDF_MIME
    )
    head = file.read(8)
    file.seek(0)
    if not head.startswith(storage.PDF_MAGIC):
        raise UploadError("unsupported_type", 415)
    key = storage.new_key(SOURCE_PREFIX)
    default_storage.save(key, file)
    return activate(book, key)


# --- Sahifalarni tayyorlash (Celery) ---


def _fail(book_id, code: str) -> None:
    Book.objects.filter(pk=book_id).update(status=BookStatus.FAILED, status_error=code)


def _purge_pages(book: Book) -> None:
    """Kitobning mavjud sahifa rasmlari va qatorlari (qayta ishlash / xato tozalash)."""
    store = covers_storage()
    for page in BookPage.objects.filter(book=book).only("image", "thumbnail"):
        storage.delete(page.image.name, store)
        storage.delete(page.thumbnail.name, store)
    BookPage.objects.filter(book=book).delete()


def process_book(book_id) -> None:
    """Manba PDF → har sahifa uchun WebP rasm + eskiz (+ matn); birinchi sahifadan avto muqova."""
    book = Book.objects.filter(pk=book_id).first()
    if book is None:
        return
    key = book.source_file.name if book.source_file else ""
    if not key:
        _fail(book_id, "no_file")
        return
    store = covers_storage()
    run = uuid.uuid4().hex[:8]  # qayta ishlashda kalitlar yangi: eski CDN keshi aralashmaydi
    _purge_pages(book)
    rows: list[BookPage] = []
    try:
        with storage.opened(key) as handle:
            document = rasterize.open_document(handle)
            try:
                total = len(document)
                for index in range(total):
                    rendered = rasterize.render_page(document, index)
                    number = index + 1
                    base = f"book-pages/{book.pk}/{run}-{number}"
                    rows.append(
                        BookPage(
                            book=book,
                            number=number,
                            image=store.save(f"{base}.webp", ContentFile(rendered.image)),
                            thumbnail=store.save(f"{base}-t.webp", ContentFile(rendered.thumbnail)),
                            width=rendered.width,
                            height=rendered.height,
                            text=rendered.text,
                        )
                    )
                    if number == 1 and not book.cover_image:
                        name = store.save(
                            f"covers/{book.pk}-{run}.webp", ContentFile(rendered.cover)
                        )
                        Book.objects.filter(pk=book.pk).update(cover_image=name)
                    if len(rows) >= FLUSH_EVERY:
                        _flush(book, rows, number)
                        rows = []
                _flush(book, rows, total)
            finally:
                document.close()
    except PdfiumError:
        logger.warning("book_invalid_pdf", book=str(book.pk))
        _purge_pages(book)
        _fail(book.pk, "invalid_pdf")
        return
    except Exception:
        logger.exception("book_render_failed", book=str(book.pk))
        _purge_pages(book)
        _fail(book.pk, "render_failed")
        raise
    ready = Book.objects.get(pk=book.pk)
    ready.status, ready.status_error = BookStatus.READY, ""
    ready.page_count = ready.processed_pages = total
    ready.save()  # signal: ochiq keshni yangilaydi


def _flush(book: Book, rows: list[BookPage], processed: int) -> None:
    if rows:
        BookPage.objects.bulk_create(rows)
    Book.objects.filter(pk=book.pk).update(processed_pages=processed)


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
    """Qator va saqlashdagi fayllar (manba PDF, muqova, sahifa rasmlari) bir tranzaksiyada.

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
