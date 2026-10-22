"""Mehmon ma'lumotini akkauntga qo'shish (kirgandan keyin bir marta; takror chaqirish xavfsiz).

Oxirgi sahifa qoidasi frontend `lib/pdf/progress.ts` (`mergePdfPosition`) bilan bir xil va
`contracts/fixtures/merge-pdf-progress.json` orqali ikki tomonda tekshiriladi.
"""

from django.db import transaction
from rest_framework.exceptions import NotFound

from .pdf import add_pdf_bookmark, apply_pdf_progress, clamp_page, resolve_pdf_book

MERGE_LIMIT = 500


def merge_guest_data(
    request, pdf_progress: list[dict] | None = None, pdf_bookmarks: list[str] | None = None
) -> dict:
    """`{pdf_progress, pdf_bookmarks, failed}`: o'zgargan yozuvlar soni va qo'shilmagan id'lar."""
    user = request.user
    result = {"pdf_progress": 0, "pdf_bookmarks": 0, "failed": []}
    with transaction.atomic():
        for item in pdf_progress or []:
            try:
                book = resolve_pdf_book(request, item["pdf_book_id"])
            except NotFound:
                result["failed"].append(item["pdf_book_id"])
                continue
            page = clamp_page(book, item["last_page"], strict=False)
            if apply_pdf_progress(user, book, page, item.get("updated_at"))[1]:
                result["pdf_progress"] += 1
        for pdf_book_id in pdf_bookmarks or []:
            try:
                book = resolve_pdf_book(request, pdf_book_id)
            except NotFound:
                result["failed"].append(pdf_book_id)
                continue
            if add_pdf_bookmark(user, book)[1]:
                result["pdf_bookmarks"] += 1
    result["failed"] = list(dict.fromkeys(result["failed"]))
    return result
