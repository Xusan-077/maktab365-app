"""PDF darsliklar: yuklash oqimi, nashr oqimi va ko'rinish qoidalari."""

import os

from django.conf import settings
from django.core.files.storage import default_storage
from django.db import transaction
from django.utils import timezone

from . import pdf_storage as storage
from .admin_services import EDITORS, InvalidTransition, TransitionForbidden, UploadError
from .cache import is_staff, show_drafts
from .models import CHAPTER_TITLE_MAX, PdfBook, PdfBookChapter, PdfBookStatus

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


# --- Mundarija ---

MAX_CHAPTERS = 500
MAX_CHAPTER_PAGE = 100_000


def chapter_errors(chapters: list[dict], page_count: int) -> list[str]:
    """Mundarija xato kodlari (bo'sh — to'g'ri); `page_count == 0` — yuqori chegara yo'q."""
    rows = [(item, False) for item in chapters]
    rows += [(child, True) for item in chapters for child in item.get("children", [])]
    codes: set[str] = set()
    if len(rows) > MAX_CHAPTERS:
        codes.add("chapters_too_many")
    for row, _is_child in rows:
        title = (row.get("title") or "").strip()
        if not title:
            codes.add("chapter_title_required")
        elif len(title) > CHAPTER_TITLE_MAX:
            codes.add("chapter_title_too_long")
        page = row.get("page")
        if not isinstance(page, int) or page < 1 or page > MAX_CHAPTER_PAGE:
            codes.add("chapter_page_invalid")
        elif page_count and page > page_count:
            codes.add("chapter_page_exceeds")
    return sorted(codes)


def _purge_chapter_slides(chapters) -> None:
    """Bo'limlarning prezentatsiya fayllarini (va tugallanmagan yuklashlarini) qat'iy o'chiradi."""
    for chapter in chapters:
        storage.abort_upload(chapter.slides_pending_file, chapter.slides_pending_upload_id)
        keys = (chapter.slides_file or "", chapter.slides_pending_file)
        for key in dict.fromkeys(key for key in keys if key):
            storage.delete_strict(key)


@transaction.atomic
def replace_chapters(book: PdfBook, chapters: list[dict]) -> None:
    """Mundarijani saqlaydi (tartib — ro'yxat tartibi).

    Qatorda `id` bo'lsa shu bo'lim joyida yangilanadi (prezentatsiyasi saqlanadi); `id` siz qator
    yangi bo'lim. Ro'yxatda yo'q bo'limlar o'chiriladi va ularning prezentatsiyasi saqlashdan qat'iy
    o'chiriladi (xatoda `storage_error` va butun o'zgarish qaytadi).
    """
    candidates = {row.pk: row for row in PdfBookChapter.objects.filter(book=book)}
    kept: set = set()
    order = 0

    def upsert(item: dict, parent: PdfBookChapter | None) -> PdfBookChapter:
        nonlocal order
        row = candidates.pop(item.get("id"), None)
        values = {"title": item["title"].strip(), "page": item["page"], "order": order}
        if row is None:
            row = PdfBookChapter.objects.create(book=book, parent=parent, **values)
        else:
            for name, value in {**values, "parent": parent}.items():
                setattr(row, name, value)
            row.save(update_fields=[*values, "parent"])
        kept.add(row.pk)
        order += 1
        return row

    for item in chapters:
        parent = upsert(item, None)
        for child in item.get("children", []):
            upsert(child, parent)

    removed = list(PdfBookChapter.objects.filter(book=book).exclude(pk__in=kept))
    _purge_chapter_slides(removed)
    PdfBookChapter.objects.filter(book=book).exclude(pk__in=kept).delete()
    getattr(book, "_prefetched_objects_cache", {}).pop("chapters", None)  # javobda eskirmasin


@transaction.atomic
def duplicate_book(book: PdfBook) -> PdfBook:
    """Kitobning qoralama nusxasi: nom (uz oxiriga « (nusxa)»), tavsif, sinf, fan, til va mundarija.

    PDF fayl, muqova va prezentatsiyalar ko'chirilmaydi (katta fayllarni saqlashda ikkilantirmaslik
    uchun): yangi nashr/versiya uchun fayl nusxadan keyin yuklanadi.
    """
    title = dict(book.title or {})
    title["uz"] = f"{title.get('uz', '')} (nusxa)".strip()
    copy = PdfBook.objects.create(
        title=title,
        description=book.description,
        grade=book.grade,
        subject=book.subject,
        language=book.language,
        allow_download=book.allow_download,
        status="draft",
    )
    tree = [
        {
            "title": chapter["title"],
            "page": chapter["page"],
            "children": [
                {"title": child["title"], "page": child["page"]} for child in chapter["children"]
            ],
        }
        for chapter in book.chapter_tree
    ]
    replace_chapters(copy, tree)
    return copy


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


def _too_large(size: int) -> bool:
    limit = settings.PDF_BOOK_MAX_BYTES  # None/0 — chegara yo'q
    return bool(limit) and size > limit


def validate_declared_pdf(filename: str, size: int, content_type: str) -> None:
    """Mijoz aytgan tur va hajmni tekshiradi (hajm chegarasisiz; haqiqiy tekshiruv `activate`da)."""
    if os.path.splitext(filename or "")[1].lower() != ".pdf":
        raise UploadError("unsupported_type", 415)
    if (content_type or "").split(";")[0].strip().lower() != storage.PDF_MIME:
        raise UploadError("unsupported_type", 415)
    if size <= 0:
        raise UploadError("file_empty")


def validate_declared(filename: str, size: int, content_type: str) -> None:
    """Kitob PDF'i: `validate_declared_pdf` + ixtiyoriy `PDF_BOOK_MAX_BYTES` chegarasi."""
    validate_declared_pdf(filename, size, content_type)
    if _too_large(size):
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
        if _too_large(size):
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


def delete_book(book: PdfBook) -> None:
    """Kitob qatorini va saqlashdagi fayllarini (PDF, muqova, tugallanmagan yuklash) o'chiradi.

    Fayllar qator bilan bir tranzaksiyada o'chiriladi: saqlash xatosida (`storage_error`, 502)
    tranzaksiya qaytadi va kitob saqlanib qoladi. Progress, xatcho'p va mundarija `CASCADE` bilan
    ketadi; rejalar (`StudyGoal`) kitobsiz qoladi.
    """
    keys = [
        book.file.name if book.file else "",
        book.cover.name if book.cover else "",
        book.cover_small.name if book.cover_small else "",
        book.cover_large.name if book.cover_large else "",
    ]
    pending_key, pending_upload = book.pending_file, book.pending_upload_id
    storage.abort_upload(pending_key, pending_upload)
    keys.append(pending_key)
    _purge_chapter_slides(PdfBookChapter.objects.filter(book=book))
    for key in dict.fromkeys(k for k in keys if k):
        storage.delete_strict(key)
    book.delete()


def purge_files(*keys: str) -> None:
    for key in keys:
        storage.delete(key)
