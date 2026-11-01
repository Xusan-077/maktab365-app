"""Bet annotatsiyalari `data` maydonini tekshirish va tozalash.

Barcha koordinatalar bet o'lchamiga nisbatan 0..1; qalinlik va matn hajmi bet **eniga** nisbatan
(zoomda mutanosib o'sadi). Noma'lum kalitlar tashlanadi, raqamlar 5 xonagacha yaxlitlanadi
(JSON hajmi kichrayadi). Xato kodlari — `ValidationError` ichida barqaror kalitlar (UI i18n qiladi).
"""

import json
import math
import re
from typing import Any

from rest_framework.exceptions import ValidationError

COLOR_RE = re.compile(r"^(#[0-9a-fA-F]{6}|ink)$")
# `marker` — yarim shaffof qalin chiziq (shaffoflik mijozda; tuzilishi qalam bilan bir xil).
PEN_TOOLS = ("pen", "marker")

MAX_POINTS = 5000
MAX_RECTS = 200
MAX_TEXT = 2000
MAX_PER_PAGE = 300
MAX_PAGE_BYTES = 500 * 1024
NOTE_MAX = 20000

WIDTH_RANGE = (0.0005, 0.06)
TEXT_SIZE_RANGE = (0.008, 0.2)


def _fail(field: str, code: str) -> ValidationError:
    return ValidationError({"data": {field: [code]}})


def _number(value: Any, low: float, high: float, field: str) -> float:
    if isinstance(value, bool) or not isinstance(value, int | float):
        raise _fail(field, "invalid_number")
    number = float(value)
    if not math.isfinite(number) or number < low or number > high:
        raise _fail(field, "out_of_range")
    return round(number, 5)


def _color(value: Any) -> str:
    if not isinstance(value, str) or not COLOR_RE.match(value):
        raise _fail("color", "invalid_color")
    return value


def _mapping(data: Any) -> dict:
    if not isinstance(data, dict):
        raise ValidationError({"data": ["invalid_data"]})
    return data


def clean_drawing(data: Any) -> dict:
    data = _mapping(data)
    if data.get("tool") not in PEN_TOOLS:
        raise _fail("tool", "invalid_tool")
    points = data.get("points")
    if not isinstance(points, list) or not points:
        raise _fail("points", "points_required")
    if len(points) > MAX_POINTS:
        raise _fail("points", "too_many_points")
    cleaned = []
    for point in points:
        if not isinstance(point, list | tuple) or len(point) not in (2, 3):
            raise _fail("points", "invalid_point")
        row = [_number(point[0], 0, 1, "points"), _number(point[1], 0, 1, "points")]
        if len(point) == 3:
            row.append(_number(point[2], 0, 1, "points"))
        cleaned.append(row)
    return {
        "tool": data["tool"],
        "color": _color(data.get("color")),
        "width": _number(data.get("width"), *WIDTH_RANGE, "width"),
        "points": cleaned,
    }


def clean_highlight(data: Any) -> dict:
    data = _mapping(data)
    rects = data.get("rects")
    if not isinstance(rects, list) or not rects:
        raise _fail("rects", "rects_required")
    if len(rects) > MAX_RECTS:
        raise _fail("rects", "too_many_rects")
    cleaned = []
    for rect in rects:
        if not isinstance(rect, dict):
            raise _fail("rects", "invalid_rect")
        x = _number(rect.get("x"), 0, 1, "rects")
        y = _number(rect.get("y"), 0, 1, "rects")
        width = _number(rect.get("w"), 0, 1, "rects")
        height = _number(rect.get("h"), 0, 1, "rects")
        if width <= 0 or height <= 0 or x + width > 1.0001 or y + height > 1.0001:
            raise _fail("rects", "out_of_range")
        cleaned.append({"x": x, "y": y, "w": width, "h": height})
    return {"color": _color(data.get("color")), "rects": cleaned}


def clean_text(data: Any) -> dict:
    data = _mapping(data)
    text = data.get("text")
    if not isinstance(text, str) or not text.strip():
        raise _fail("text", "text_required")
    if len(text) > MAX_TEXT:
        raise _fail("text", "text_too_long")
    return {
        "x": _number(data.get("x"), 0, 1, "x"),
        "y": _number(data.get("y"), 0, 1, "y"),
        "text": text,
        "color": _color(data.get("color")),
        "size": _number(data.get("size"), *TEXT_SIZE_RANGE, "size"),
    }


SOLUTION_TITLE_MAX = 80
SOLUTION_BODY_MAX = 4000


def clean_solution(data: Any) -> dict:
    """Misol yechimi: bet ustidagi to'rtburchak + sarlavha + matn (LaTeX `$...$` bilan)."""
    data = _mapping(data)
    rect = data.get("rect")
    if not isinstance(rect, dict):
        raise _fail("rect", "rect_required")
    x = _number(rect.get("x"), 0, 1, "rect")
    y = _number(rect.get("y"), 0, 1, "rect")
    width = _number(rect.get("w"), 0, 1, "rect")
    height = _number(rect.get("h"), 0, 1, "rect")
    if width <= 0 or height <= 0 or x + width > 1.0001 or y + height > 1.0001:
        raise _fail("rect", "out_of_range")
    title = data.get("title", "")
    body = data.get("body", "")
    if not isinstance(title, str) or not isinstance(body, str):
        raise _fail("body", "invalid_text")
    title = title.strip()
    if len(title) > SOLUTION_TITLE_MAX:
        raise _fail("title", "title_too_long")
    if len(body) > SOLUTION_BODY_MAX:
        raise _fail("body", "text_too_long")
    return {"rect": {"x": x, "y": y, "w": width, "h": height}, "title": title, "body": body}


def ensure_type_allowed(book, annotation_type: str) -> None:
    """Maxsus rejim turlari faqat o'z kitob turida: `solution` — faqat math kitobda."""
    if annotation_type == "solution" and getattr(book, "reading_mode", None) != "math":
        raise ValidationError({"type": ["solution_not_allowed"]})


CLEANERS = {
    "drawing": clean_drawing,
    "highlight": clean_highlight,
    "text": clean_text,
    "solution": clean_solution,
}


def clean_data(annotation_type: str, data: Any) -> dict:
    return CLEANERS[annotation_type](data)


def data_size(data: dict) -> int:
    """JSON hajmi (bayt): bet uchun umumiy chegara shu bilan o'lchanadi."""
    return len(json.dumps(data, separators=(",", ":"), ensure_ascii=False).encode())


def check_page_budget(sizes: list[int]) -> None:
    if len(sizes) > MAX_PER_PAGE:
        raise ValidationError({"annotations": ["too_many_annotations"]})
    if sum(sizes) > MAX_PAGE_BYTES:
        raise ValidationError({"annotations": ["page_too_large"]})
