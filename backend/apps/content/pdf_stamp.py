"""PDF watermark: ekrandagi nusxa toza, yuklab olish nusxasida kichik yozuv (pastki o'ng burchak).

- `strip_baked_watermark` — fayl yuklanishidan oldin (sayt tashqarisida, PyMuPDF bilan) qo'shilgan
  diagonal "darslik365.uz" qatlamini olib tashlaydi: har sahifa oxiridagi alohida
  `q /fzFrmN Do Q` kontent bo'lagi (formula va matn ustiga tushadi). Faqat shu andoza va sahifa
  matnida belgi bo'lsa — boshqa kontentga tegilmaydi.
- `add_corner_watermark` — yuklab olish nusxasiga: 7pt, kulrang, 50% shaffof, burchakdan 14pt;
  `/Rotate` hisobga olinadi (ko'rinadigan pastki o'ng burchak). Asl kontent `q … Q` ichida qoladi.
"""

import re

from pypdf import PdfReader, PdfWriter
from pypdf.generic import (
    ArrayObject,
    DecodedStreamObject,
    DictionaryObject,
    FloatObject,
    NameObject,
)

WATERMARK_TEXT = "darslik365.uz"
WATERMARK_MARKER = "darslik365"
FONT_SIZE = 7
MARGIN = 14
OPACITY = 0.5
GRAY = 0.35
# Helvetica AFM kengliklari (1/1000 em) — `WATERMARK_TEXT` ning har belgisi uchun.
_HELVETICA = {"d": 556, "a": 556, "r": 333, "s": 500, "l": 222, "i": 222, "k": 500}
_HELVETICA.update({"3": 556, "6": 556, "5": 556, ".": 278, "u": 556, "z": 500})
TEXT_WIDTH = sum(_HELVETICA[ch] for ch in WATERMARK_TEXT) * FONT_SIZE / 1000

FONT_NAME = NameObject("/Fdl365")
STATE_NAME = NameObject("/GSdl365")
_BAKED = re.compile(rb"^\s*q\s*/fzFrm\d+\s+Do\s*Q\s*$")


def _stream(data: bytes) -> DecodedStreamObject:
    stream = DecodedStreamObject()
    stream.set_data(data)
    return stream


def strip_baked_watermark(writer: PdfWriter) -> int:
    """Diagonal qatlamni olib tashlaydi; tozalangan sahifalar soni."""
    cleaned = 0
    for page in writer.pages:
        contents = page.get("/Contents")
        if contents is None:
            continue
        items = contents.get_object()
        if not isinstance(items, ArrayObject) or len(items) < 2:
            continue
        last = items[-1].get_object()
        if not _BAKED.match(last.get_data()):
            continue
        if WATERMARK_MARKER not in (page.extract_text() or "").lower():
            continue
        page[NameObject("/Contents")] = ArrayObject(items[:-1])
        cleaned += 1
    return cleaned


def _resources(page) -> DictionaryObject:
    """Sahifaning o'z `/Resources` lug'ati (ota tugundan meros bo'lsa nusxasi sahifaga yoziladi)."""
    node = page
    while node is not None and "/Resources" not in node:
        node = node.get("/Parent")
        node = node.get_object() if node is not None else None
    found = node["/Resources"].get_object() if node is not None else DictionaryObject()
    if node is not page:
        found = DictionaryObject(found)
        page[NameObject("/Resources")] = found
    return found


def _sub(resources: DictionaryObject, key: str) -> DictionaryObject:
    value = resources.get(key)
    if value is None:
        value = DictionaryObject()
        resources[NameObject(key)] = value
    return value.get_object()


def _placement(page) -> tuple[float, ...]:
    """Matn matritsasi (a b c d e f): ko'rinadigan pastki o'ng burchak, `/Rotate` bo'yicha."""
    box = page.cropbox
    x0, y0, x1, y1 = float(box.left), float(box.bottom), float(box.right), float(box.top)
    rotate = int(page.get("/Rotate", 0) or 0) % 360
    width, height = (y1 - y0, x1 - x0) if rotate in (90, 270) else (x1 - x0, y1 - y0)
    # Ko'rinadigan koordinatada boshlanish nuqtasi (X, Y) → foydalanuvchi koordinatasi.
    sx, sy = width - MARGIN - TEXT_WIDTH, MARGIN
    if rotate == 90:
        return (0, 1, -1, 0, x1 - sy, y0 + sx)
    if rotate == 180:
        return (-1, 0, 0, -1, x1 - sx, y1 - sy)
    if rotate == 270:
        return (0, -1, 1, 0, x0 + sy, y1 - sx)
    return (1, 0, 0, 1, x0 + sx, y0 + sy)


def add_corner_watermark(writer: PdfWriter) -> None:
    font = writer._add_object(
        DictionaryObject(
            {
                NameObject("/Type"): NameObject("/Font"),
                NameObject("/Subtype"): NameObject("/Type1"),
                NameObject("/BaseFont"): NameObject("/Helvetica"),
                NameObject("/Encoding"): NameObject("/WinAnsiEncoding"),
            }
        )
    )
    state = writer._add_object(
        DictionaryObject(
            {NameObject("/Type"): NameObject("/ExtGState"), NameObject("/ca"): FloatObject(OPACITY)}
        )
    )
    for page in writer.pages:
        resources = _resources(page)
        _sub(resources, "/Font")[FONT_NAME] = font
        _sub(resources, "/ExtGState")[STATE_NAME] = state
        matrix = " ".join(f"{value:.3f}" for value in _placement(page))
        stamp = (
            f"\nQ q {STATE_NAME} gs {GRAY} g BT {FONT_NAME} {FONT_SIZE} Tf {matrix} Tm "
            f"({WATERMARK_TEXT}) Tj ET Q\n"
        ).encode("ascii")
        contents = page.get("/Contents")
        original = [] if contents is None else contents.get_object()
        original = list(original) if isinstance(original, ArrayObject) else [contents]
        page[NameObject("/Contents")] = ArrayObject(
            [writer._add_object(_stream(b"q\n")), *original, writer._add_object(_stream(stamp))]
        )


def prepare(source, view_out, download_out) -> int:
    """Manba PDF → ekran nusxasi (diagonal qatlamsiz) va yuklab olish nusxasi (burchakda yozuv).

    Ikkala chiqish — yozish uchun ochilgan fayllar. Qaytaradi: tozalangan sahifalar soni (0 —
    asl faylda qatlam yo'q, ekran nusxasini almashtirish shart emas).
    """
    writer = PdfWriter(clone_from=PdfReader(source, strict=False))
    cleaned = strip_baked_watermark(writer)
    if cleaned:
        writer.write(view_out)
    add_corner_watermark(writer)
    writer.write(download_out)
    return cleaned
