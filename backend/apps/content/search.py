"""
Mavzu qidiruvi: PostgreSQL full-text ('simple' konfiguratsiya, so'z boshi bo'yicha prefiks) +
kirill/lotin normallashtirish (`apps.core.translit`).

Indeks: sarlavha (A) > qisqa mazmun (B) > blok matnlari (C). Kirill so'rov ham, kirill kontent ham
lotinga o'giriladi, shuning uchun "квадрат" ham, "kvadrat" ham topiladi. Snippet Python'da,
asl matndan qurilib, mos so'zlar `⟦…⟧` bilan belgilanadi (frontend shu belgilar bo'yicha ajratadi).
"""

from __future__ import annotations

import re
from typing import Any

from django.contrib.postgres.search import SearchQuery, SearchRank, SearchVector
from django.db.models import F, Value

from apps.core.translit import normalize_search_text

LOCALES = ("uz", "ru", "en")
MARK_START, MARK_END = "⟦", "⟧"
SNIPPET_WORDS = 18
_TOKEN = re.compile(r"[a-z0-9]+")
_WORD = re.compile(r"\S+")


def _texts(value: Any) -> dict[str, str]:
    """`LocalizedText` → `{locale: text}` (faqat to'ldirilganlar)."""
    if not isinstance(value, dict):
        return {}
    return {loc: text for loc, text in value.items() if isinstance(text, str) and text.strip()}


def _block_texts(block: dict[str, Any]) -> list[Any]:
    """Blokdagi o'qiladigan `LocalizedText`lar (formula va kodlar emas)."""
    found: list[Any] = [block.get("title"), block.get("text"), block.get("question")]
    found += [step.get("text") for step in block.get("steps", [])]
    found += list(block.get("points", []))
    found += list(block.get("options", [])) if block.get("answerType") == "choice" else []
    found += [block.get("hint"), block.get("explanation")]
    return found


def body_by_locale(topic) -> dict[str, str]:
    """Mavzuning til bo'yicha oddiy matni (qisqa mazmun va bloklar; sarlavhasiz)."""
    chunks: dict[str, list[str]] = {loc: [] for loc in LOCALES}
    sources = [topic.summary]
    for block in topic.blocks if isinstance(topic.blocks, list) else []:
        if isinstance(block, dict):
            sources += _block_texts(block)
    for source in sources:
        for loc, text in _texts(source).items():
            if loc in chunks:
                chunks[loc].append(text.strip())
    return {loc: " ".join(parts) for loc, parts in chunks.items() if parts}


def reindex_topic(topic) -> None:
    """`search_vector` va `search_body` ni yangilaydi (UPDATE; `save()` ni qayta chaqirmaydi)."""
    title = " ".join(_texts(topic.title).values())
    summary = " ".join(_texts(topic.summary).values())
    body = body_by_locale(topic)
    vector = (
        SearchVector(Value(normalize_search_text(title)), weight="A", config="simple")
        + SearchVector(Value(normalize_search_text(summary)), weight="B", config="simple")
        + SearchVector(
            Value(normalize_search_text(" ".join(body.values()))), weight="C", config="simple"
        )
    )
    type(topic).objects.filter(pk=topic.pk).update(search_vector=vector, search_body=body)
    topic.search_body = body


def query_terms(query: str) -> list[str]:
    return _TOKEN.findall(normalize_search_text(query))


def build_query(terms: list[str]) -> SearchQuery:
    # Atamalar faqat [a-z0-9] — raw tsquery xavfsiz. Har biri prefiks (`kvad:*`), hammasi kerak.
    return SearchQuery(
        " & ".join(f"{term}:*" for term in terms), search_type="raw", config="simple"
    )


def search_topics(queryset, terms: list[str]):
    """Mos mavzular, mosligi bo'yicha tartiblangan (`rank` annotatsiyasi bilan)."""
    query = build_query(terms)
    return (
        queryset.filter(search_vector=query)
        .annotate(rank=SearchRank(F("search_vector"), query))
        .order_by("-rank", "book__grade", "chapter__order", "order")
    )


def make_snippet(topic, terms: list[str], locale: str) -> str:
    """Asl matndan mos so'zlar (`⟦…⟧` ichida) atrofidagi parcha; mos so'z bo'lmasa — bosh qismi."""
    body = topic.search_body or {}
    text = body.get(locale) or body.get("uz") or next(iter(body.values()), "")
    words = _WORD.findall(text)
    hits = [
        index
        for index, word in enumerate(words)
        if any(
            token.startswith(term)
            for token in _TOKEN.findall(normalize_search_text(word))
            for term in terms
        )
    ]
    if not words:
        return ""
    start = max(0, (hits[0] if hits else 0) - SNIPPET_WORDS // 3)
    end = min(len(words), start + SNIPPET_WORDS)
    hit_set = set(hits)
    shown = [
        f"{MARK_START}{word}{MARK_END}" if index in hit_set else word
        for index, word in enumerate(words[start:end], start)
    ]
    return ("… " if start else "") + " ".join(shown) + (" …" if end < len(words) else "")
