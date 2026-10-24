import uuid

import pytest
from django.core.cache import cache

from apps.content.models import PdfBook, Subject


@pytest.fixture(autouse=True)
def clear_cache():
    cache.clear()
    yield
    cache.clear()


class Catalog:
    """Test katalogi yaratuvchisi."""

    def subject(self, slug="algebra", **over):
        return Subject.objects.create(slug=slug, title={"uz": slug.title()}, order=1, **over)

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


@pytest.fixture
def catalog(db):
    return Catalog()
