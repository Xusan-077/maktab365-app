"""
PDF darsliklar fayli: saqlash, yuklash va o'qish URL'lari.

Ikki rejim, `default_storage` ga qarab:
- S3-mos (R2/S3, `AWS_STORAGE_BUCKET_NAME`): brauzer faylni multipart bilan to'g'ridan-to'g'ri
  obyekt saqlashga yuklaydi va imzolangan GET URL bilan o'qiydi (Range'ni saqlashning o'zi beradi);
  fayl baytlari Vercel BFF/Django'dan o'tmaydi.
- Lokal (dev): baytlar backend orqali (`upload/`, `file/`; Range qo'llab-quvvatlanadi).
"""

import math
import tempfile
import uuid
from dataclasses import dataclass

import structlog
from django.conf import settings
from django.core import signing
from django.core.files.storage import default_storage

from .admin_services import UploadError as PdfError

PDF_MIME = "application/pdf"
PDF_MAGIC = b"%PDF-"
FILE_TOKEN_SALT = "pdf-book-file"  # noqa: S105 — imzo "tuzi", sir emas

logger = structlog.get_logger(__name__)


def is_remote() -> bool:
    return bool(getattr(settings, "AWS_STORAGE_BUCKET_NAME", ""))


def new_key() -> str:
    return f"pdf-books/{uuid.uuid4()}.pdf"


def _client():
    return default_storage.connection.meta.client


def _bucket() -> str:
    return settings.AWS_STORAGE_BUCKET_NAME


def part_count(size: int) -> int:
    return max(1, math.ceil(size / settings.PDF_UPLOAD_PART_BYTES))


@dataclass(frozen=True)
class UploadPlan:
    mode: str  # "direct" (S3 multipart) | "proxy" (backend'ga multipart/form-data)
    key: str
    upload_id: str = ""
    part_size: int = 0
    part_urls: tuple[str, ...] = ()


def start_upload(size: int) -> UploadPlan:
    key = new_key()
    if not is_remote():
        return UploadPlan("proxy", key)
    ttl = settings.PDF_SIGNED_URL_SECONDS
    upload_id = _client().create_multipart_upload(Bucket=_bucket(), Key=key, ContentType=PDF_MIME)[
        "UploadId"
    ]
    urls = tuple(
        _client().generate_presigned_url(
            "upload_part",
            Params={"Bucket": _bucket(), "Key": key, "UploadId": upload_id, "PartNumber": number},
            ExpiresIn=ttl,
        )
        for number in range(1, part_count(size) + 1)
    )
    return UploadPlan("direct", key, upload_id, settings.PDF_UPLOAD_PART_BYTES, urls)


def abort_upload(key: str, upload_id: str) -> None:
    """Tugallanmagan multipart'ni bekor qiladi (xato bo'lsa ham indamaydi)."""
    if key and upload_id and is_remote():
        try:
            _client().abort_multipart_upload(Bucket=_bucket(), Key=key, UploadId=upload_id)
        except Exception:  # noqa: BLE001 — tozalash urinishi, asosiy oqimni buzmasin
            logger.warning("pdf_abort_upload_failed", key=key)


def finish_multipart(key: str, upload_id: str, parts: list[dict]) -> None:
    ordered = sorted(parts, key=lambda part: part["part_number"])
    numbers = [part["part_number"] for part in ordered]
    if not numbers or numbers != list(range(1, len(numbers) + 1)):
        raise PdfError("invalid_parts")
    try:
        _client().complete_multipart_upload(
            Bucket=_bucket(),
            Key=key,
            UploadId=upload_id,
            MultipartUpload={
                "Parts": [{"PartNumber": p["part_number"], "ETag": p["etag"]} for p in ordered]
            },
        )
    except Exception as exc:  # noqa: BLE001 — boto xatolari turli; mijozga bitta kod
        raise PdfError("upload_incomplete", 400) from exc


def stored_size(key: str) -> int:
    return default_storage.size(key)


def read_head(key: str, length: int = 16) -> bytes:
    if is_remote():
        body = _client().get_object(Bucket=_bucket(), Key=key, Range=f"bytes=0-{length - 1}")
        return body["Body"].read()
    with default_storage.open(key, "rb") as handle:
        return handle.read(length)


def exists(key: str) -> bool:
    return bool(key) and default_storage.exists(key)


def delete(key: str) -> None:
    if key:
        try:
            default_storage.delete(key)
        except Exception:  # noqa: BLE001 — yetim fayl yozuvni o'chirishga to'sqinlik qilmasin
            logger.warning("pdf_delete_failed", key=key)


def _pages_of(handle) -> int:
    from pypdf import PdfReader
    from pypdf.errors import PyPdfError

    try:
        reader = PdfReader(handle, strict=False)
        if reader.is_encrypted:
            raise PdfError("pdf_encrypted")
        pages = len(reader.pages)
    except PdfError:
        raise
    except (PyPdfError, ValueError, KeyError, RecursionError, OSError) as exc:
        raise PdfError("invalid_pdf") from exc
    if pages < 1:
        raise PdfError("invalid_pdf")
    return pages


def count_pages(key: str) -> int:
    """Sahifalar soni (pypdf). Shifrlangan/buzuq PDF rad etiladi.

    Fayl RAM'ga to'liq o'qilmaydi: S3'dan bo'laklab vaqtinchalik faylga oqiladi (u `with` tugashi
    bilan, xatoda ham, o'chadi); lokal saqlashda fayl joyida ochiladi (nusxa kerak emas).
    """
    if not is_remote():
        with default_storage.open(key, "rb") as handle:
            return _pages_of(handle)
    with tempfile.TemporaryFile() as tmp:
        _client().download_fileobj(Bucket=_bucket(), Key=key, Fileobj=tmp)
        tmp.seek(0)
        return _pages_of(tmp)


def read_url(book) -> dict:
    """O'qish URL'i: S3'da imzolangan GET, lokalda imzolangan backend yo'li (token)."""
    ttl = settings.PDF_SIGNED_URL_SECONDS
    if is_remote():
        url = _client().generate_presigned_url(
            "get_object",
            Params={
                "Bucket": _bucket(),
                "Key": book.file.name,
                "ResponseContentType": PDF_MIME,
                "ResponseContentDisposition": "inline",
            },
            ExpiresIn=ttl,
        )
    else:
        token = signing.dumps({"book": str(book.pk), "key": book.file.name}, salt=FILE_TOKEN_SALT)
        url = f"/api/v1/pdf-books/{book.pk}/file/?token={token}"
    return {"url": url, "expires_in": ttl}


def check_file_token(token: str, book) -> bool:
    try:
        data = signing.loads(
            token, salt=FILE_TOKEN_SALT, max_age=settings.PDF_SIGNED_URL_SECONDS + 60
        )
    except signing.BadSignature:
        return False
    # Fayl almashtirilgan bo'lsa eski token yaroqsiz (kalit boshqa).
    return data.get("book") == str(book.pk) and data.get("key") == book.file.name
