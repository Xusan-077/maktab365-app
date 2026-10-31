import io

import pytest
from django.core.cache import cache
from django.db import transaction
from pypdf import PdfWriter
from rest_framework.test import APIClient


@pytest.fixture(autouse=True)
def clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture(autouse=True)
def local_storage(settings, tmp_path):
    settings.AWS_STORAGE_BUCKET_NAME = ""  # backend/.env dagi qiymatdan mustaqil
    settings.MEDIA_ROOT = tmp_path


@pytest.fixture(autouse=True)
def immediate_on_commit(monkeypatch):
    """`db` fixture tranzaksiyasi commit qilinmaydi: `on_commit` (Celery eager) darhol ishlasin."""
    monkeypatch.setattr(transaction, "on_commit", lambda func, *args, **kwargs: func())


@pytest.fixture
def anon():
    return APIClient()


def blank_pdf(pages=3, encrypt=False) -> bytes:
    writer = PdfWriter()
    for _ in range(pages):
        writer.add_blank_page(width=300, height=420)
    if encrypt:
        writer.encrypt("owner-secret")
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def text_pdf(lines: list[str]) -> bytes:
    """Har qator alohida sahifada, standart Helvetica shrifti bilan matn qatlami bor PDF."""
    objects: list[bytes] = []

    def add(body: str) -> int:
        objects.append(body.encode())
        return len(objects)

    add("<< /Type /Catalog /Pages 2 0 R >>")
    kids = " ".join(f"{4 + i * 2} 0 R" for i in range(len(lines)))
    add(f"<< /Type /Pages /Kids [{kids}] /Count {len(lines)} >>")
    add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    for index, line in enumerate(lines):
        content_id = 5 + index * 2
        add(
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 420] /Contents {content_id} 0 R "
            f"/Resources << /Font << /F1 3 0 R >> >> >>"
        )
        stream = f"BT /F1 14 Tf 20 380 Td ({line}) Tj ET"
        add(f"<< /Length {len(stream)} >>\nstream\n{stream}\nendstream")
    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{number} 0 obj\n".encode() + body + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode()
    for offset in offsets:
        out += f"{offset:010d} 00000 n \n".encode()
    out += (
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    )
    return bytes(out)
