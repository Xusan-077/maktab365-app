"""
PDF darsliklar fayli: saqlash, yuklash va o'qish URL'lari.

Ikki rejim, `default_storage` ga qarab:
- S3-mos (R2/S3, `AWS_STORAGE_BUCKET_NAME`): brauzer faylni multipart bilan to'g'ridan-to'g'ri
  obyekt saqlashga yuklaydi va imzolangan GET URL bilan o'qiydi (Range'ni saqlashning o'zi beradi);
  fayl baytlari Vercel BFF/Django'dan o'tmaydi.
- Lokal (dev): baytlar backend orqali (`upload/`, `file/`; Range qo'llab-quvvatlanadi).
"""

import math
import re
import tempfile
import uuid
from dataclasses import dataclass
from urllib.parse import quote, urlencode

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


BOOK_PREFIX = "pdf-books"
SLIDES_PREFIX = "pdf-slides"


def new_key(prefix: str = BOOK_PREFIX) -> str:
    return f"{prefix}/{uuid.uuid4()}.pdf"


def _client():
    return default_storage.connection.meta.client


def _bucket() -> str:
    return settings.AWS_STORAGE_BUCKET_NAME


MAX_PARTS = 10_000  # S3/R2: bir multipart yuklashda eng ko'pi bilan
MIB = 1024 * 1024


def part_size_for(size: int, min_part: int | None = None) -> int:
    """Bo'lak hajmi: kamida `PDF_UPLOAD_PART_BYTES`; bo'laklar `MAX_PARTS` dan oshmasligi uchun
    kattalashadi (butun MiB gacha yuqoriga). Frontend `lib/admin/pdf-parts.ts` bilan bir xil."""
    floor = settings.PDF_UPLOAD_PART_BYTES if min_part is None else min_part
    needed = math.ceil(size / MAX_PARTS)
    if needed <= floor:
        return floor
    return math.ceil(needed / MIB) * MIB


def part_count(size: int, part_size: int | None = None) -> int:
    return max(1, math.ceil(size / (part_size or part_size_for(size))))


@dataclass(frozen=True)
class UploadPlan:
    mode: str  # "direct" (S3 multipart) | "proxy" (backend'ga multipart/form-data)
    key: str
    upload_id: str = ""
    part_size: int = 0
    part_urls: tuple[str, ...] = ()


def start_upload(size: int, prefix: str = BOOK_PREFIX) -> UploadPlan:
    key = new_key(prefix)
    if not is_remote():
        return UploadPlan("proxy", key)
    ttl = settings.PDF_SIGNED_URL_SECONDS
    part_size = part_size_for(size)
    upload_id = _client().create_multipart_upload(Bucket=_bucket(), Key=key, ContentType=PDF_MIME)[
        "UploadId"
    ]
    urls = tuple(
        _client().generate_presigned_url(
            "upload_part",
            Params={"Bucket": _bucket(), "Key": key, "UploadId": upload_id, "PartNumber": number},
            ExpiresIn=ttl,
        )
        for number in range(1, part_count(size, part_size) + 1)
    )
    return UploadPlan("direct", key, upload_id, part_size, urls)


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


def delete_strict(key: str) -> None:
    """Obyektni o'chiradi; saqlash xatosi bo'lsa `storage_error` (502) ko'taradi.

    Yo'q obyekt xato emas (S3 `DeleteObject` idempotent, lokal saqlash ham indamaydi).
    """
    if not key:
        return
    try:
        default_storage.delete(key)
    except Exception as exc:  # noqa: BLE001 — boto/OS xatolari turli; mijozga bitta kod
        logger.warning("pdf_delete_failed", key=key)
        raise PdfError("storage_error", 502) from exc


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


def _read_url(key: str, owner: str, local_path: str, filename: str | None = None) -> dict:
    """S3'da imzolangan GET, lokalda imzolangan backend yo'li (token: egasi + kalit).

    `filename` berilsa `Content-Disposition: attachment` (yuklab olish), aks holda `inline`.
    """
    ttl = settings.PDF_SIGNED_URL_SECONDS
    if is_remote():
        url = _client().generate_presigned_url(
            "get_object",
            Params={
                "Bucket": _bucket(),
                "Key": key,
                "ResponseContentType": PDF_MIME,
                "ResponseContentDisposition": content_disposition(filename),
            },
            ExpiresIn=ttl,
        )
    else:
        token = signing.dumps({"book": owner, "key": key}, salt=FILE_TOKEN_SALT)
        url = f"{local_path}?token={token}"
        if filename:
            url += f"&{urlencode({'download': filename})}"
    return {"url": url, "expires_in": ttl}


def content_disposition(filename: str | None) -> str:
    """`inline` yoki `attachment` (ASCII zaxira + RFC 5987 `filename*` — o'zbekcha harflar)."""
    if not filename:
        return "inline"
    ascii_name = re.sub(r"[^A-Za-z0-9._ -]+", "_", filename).strip() or "book.pdf"
    return f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(filename)}"


def download_filename(book) -> str:
    """Chiroyli fayl nomi: «Algebra - 9-sinf - Maktab365.pdf» (yo'l belgilarisiz)."""
    title = (book.title or {}).get("uz") or book.slug
    title = re.sub(r'[\\/:*?"<>|\s]+', " ", title).strip()[:80]
    return f"{title} - {book.grade}-sinf - Maktab365.pdf"


def download_url(book) -> dict:
    """Kitob PDF'ini yuklab olish URL'i (`attachment`, chiroyli nom)."""
    name = download_filename(book)
    result = _read_url(
        book.file.name, str(book.pk), f"/api/v1/pdf-books/{book.pk}/file/", filename=name
    )
    return {**result, "filename": name}


def read_url(book) -> dict:
    """Kitob PDF'ining o'qish URL'i."""
    return _read_url(book.file.name, str(book.pk), f"/api/v1/pdf-books/{book.pk}/file/")


def slides_read_url(book, chapter) -> dict:
    """Bo'lim prezentatsiyasining o'qish URL'i (kitob PDF'i bilan bir xil mexanizm)."""
    path = f"/api/v1/pdf-books/{book.pk}/chapters/{chapter.pk}/slides/file/"
    return _read_url(chapter.slides_file, str(book.pk), path)


def check_key_token(token: str, book_id, key: str) -> bool:
    try:
        data = signing.loads(
            token, salt=FILE_TOKEN_SALT, max_age=settings.PDF_SIGNED_URL_SECONDS + 60
        )
    except signing.BadSignature:
        return False
    # Fayl almashtirilgan bo'lsa eski token yaroqsiz (kalit boshqa).
    return data.get("book") == str(book_id) and data.get("key") == key


def check_file_token(token: str, book) -> bool:
    return check_key_token(token, book.pk, book.file.name)
