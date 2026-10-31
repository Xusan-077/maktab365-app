"""PDF → sahifa rasmlari (WebP) + eskiz + muqova. Sahifa-sahifa: xotira PDF hajmiga bog'liq emas."""

import io
from dataclasses import dataclass

import pypdfium2 as pdfium

PAGE_WIDTH = 1400  # o'qish rasmi eni (px): retina uchun yetarli, hajmi kichik
THUMB_WIDTH = 240
COVER_WIDTH = 600
MAX_SCALE = 3.0  # juda kichik sahifa cheksiz kattalashib ketmasin
MAX_PIXELS = 40_000_000  # juda katta sahifa (plakat) xotirani to'ldirmasin
WEBP_QUALITY = 80
THUMB_QUALITY = 70
MIN_TEXT_CHARS = 20


@dataclass(frozen=True)
class RenderedPage:
    image: bytes
    thumbnail: bytes
    cover: bytes
    width: int
    height: int
    text: str


def _webp(image, quality: int) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format="WEBP", quality=quality, method=4)
    return buffer.getvalue()


def _resized(image, width: int):
    if image.width <= width:
        return image
    height = max(1, round(image.height * width / image.width))
    return image.resize((width, height))


def open_document(handle) -> pdfium.PdfDocument:
    return pdfium.PdfDocument(handle)


def render_page(document: pdfium.PdfDocument, index: int) -> RenderedPage:
    page = document[index]
    try:
        page_width, page_height = page.get_size()
        scale = min(MAX_SCALE, PAGE_WIDTH / max(page_width, 1.0))
        while page_width * page_height * scale * scale > MAX_PIXELS and scale > 0.1:
            scale *= 0.8
        image = page.render(scale=scale).to_pil().convert("RGB")
        return RenderedPage(
            image=_webp(image, WEBP_QUALITY),
            thumbnail=_webp(_resized(image, THUMB_WIDTH), THUMB_QUALITY),
            cover=_webp(_resized(image, COVER_WIDTH), WEBP_QUALITY),
            width=image.width,
            height=image.height,
            text=_page_text(page),
        )
    finally:
        page.close()


def _page_text(page) -> str:
    textpage = page.get_textpage()
    try:
        text = textpage.get_text_range().strip()
    finally:
        textpage.close()
    return text if len(text) >= MIN_TEXT_CHARS else ""
