"""Xatcho'plar (mavzu va kitob). Hammasi idempotent: takror qo'shish/olib tashlash xavfsiz."""

from django.db import IntegrityError, transaction
from rest_framework.exceptions import NotFound

from apps.content.cache import is_staff
from apps.content.models import Book

from ..models import Bookmark, BookmarkKind


def visible_book(request, slug: str) -> Book:
    books = Book.objects.all() if is_staff(request.user) else Book.objects.filter(is_published=True)
    book = books.filter(slug=slug).first()
    if book is None:
        raise NotFound("Book not found.")
    return book


def add_bookmark(user, *, topic=None, book=None) -> tuple[Bookmark, bool]:
    """`(xatcho'p, yangi yaratildimi)`."""
    kind = BookmarkKind.TOPIC if topic is not None else BookmarkKind.BOOK
    target = {"topic": topic} if topic is not None else {"book": book}
    existing = Bookmark.objects.filter(user=user, kind=kind, **target).first()
    if existing:
        return existing, False
    try:
        with transaction.atomic():
            return Bookmark.objects.create(user=user, kind=kind, **target), True
    except IntegrityError:
        # Parallel so'rov oldin yaratib qo'ydi.
        return Bookmark.objects.get(user=user, kind=kind, **target), False


def remove_bookmark(user, *, topic=None, book=None) -> None:
    kind = BookmarkKind.TOPIC if topic is not None else BookmarkKind.BOOK
    target = {"topic": topic} if topic is not None else {"book": book}
    Bookmark.objects.filter(user=user, kind=kind, **target).delete()
