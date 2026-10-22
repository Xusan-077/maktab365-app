import json
import uuid
from pathlib import Path

import pytest
from django.core.cache import cache

from apps.content.models import Book, Chapter, PdfBook, Subject, Topic

FIXTURES = Path(__file__).resolve().parents[4] / "contracts" / "fixtures"


@pytest.fixture(autouse=True)
def clear_cache(settings):
    settings.SHOW_DRAFTS_PUBLICLY = False  # backend/.env dagi dev qiymatidan mustaqil
    cache.clear()
    yield
    cache.clear()


def valid_blocks():
    return json.loads((FIXTURES / "topic-valid.json").read_text(encoding="utf-8"))["blocks"]


class Catalog:
    """Test katalogi yaratuvchisi."""

    def __init__(self):
        self.blocks = valid_blocks()

    def subject(self, slug="algebra", **over):
        return Subject.objects.create(slug=slug, title={"uz": slug.title()}, order=1, **over)

    def book(self, subject, slug="algebra-9", grade=9, published=True, **over):
        return Book.objects.create(
            slug=slug,
            subject=subject,
            grade=grade,
            title=over.pop("title", {"uz": f"{subject.slug.title()}. {grade}-sinf"}),
            author={"uz": "Mualliflar jamoasi"},
            edition={"uz": "1-nashr"},
            year=2020,
            is_published=published,
            **over,
        )

    def pdf_book(self, subject, grade=9, status="published", pages=12, **over):
        """Fayli bor PDF kitob (baytlarsiz: saqlash kaliti yozuvda)."""
        return PdfBook.objects.create(
            title=over.pop("title", {"uz": f"{subject.slug.title()} PDF"}),
            grade=grade,
            subject=subject,
            file=over.pop("file", f"pdf-books/{uuid.uuid4()}.pdf"),
            size_bytes=1024,
            page_count=pages,
            status=status,
            **over,
        )

    def chapter(self, book, slug="bob-1", order=1):
        return Chapter.objects.create(book=book, slug=slug, title={"uz": slug}, order=order)

    def topic(self, chapter, slug, order=1, status="published", title=None, summary=None, **over):
        return Topic.objects.create(
            chapter=chapter,
            slug=slug,
            order=order,
            status=status,
            title=title or {"uz": slug.title()},
            summary=summary or {"uz": "Qisqa mazmun"},
            blocks=over.pop("blocks", self.blocks),
            **over,
        )


@pytest.fixture
def catalog(db):
    return Catalog()


@pytest.fixture
def library(catalog):
    """Algebra-9: 2 bob, 3 published + 1 draft mavzu; Geometriya-8: 1 published mavzu."""
    algebra = catalog.subject("algebra")
    geometry = catalog.subject("geometriya")
    book = catalog.book(algebra, "algebra-9", 9)
    other = catalog.book(geometry, "geometry-8", 8)
    ch1 = catalog.chapter(book, "kvadrat", 1)
    ch2 = catalog.chapter(book, "tengsizliklar", 2)
    catalog.topic(
        ch1,
        "diskriminant",
        1,
        title={"uz": "Diskriminant", "ru": "Дискриминант"},
        summary={"uz": "Kvadrat tenglama ildizlari"},
    )
    catalog.topic(ch1, "viyet", 2)
    catalog.topic(ch2, "chiziqli", 1)
    catalog.topic(ch2, "qoralama", 2, status="draft")
    catalog.topic(catalog.chapter(other, "uchburchak", 1), "pifagor", 1)
    return {"algebra": algebra, "geometry": geometry, "book": book, "other": other}
