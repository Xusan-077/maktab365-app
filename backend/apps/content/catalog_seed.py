"""
Import uchun katalog metama'lumoti: kontent papkasi faqat slug'larni beradi
(`fan/kitob/bob/mavzu`), fan va kitobning sarlavhasi/muallifi/yili esa shu yerdan olinadi
(frontend `src/mocks/data` bilan bir xil). Ro'yxatda yo'q slug'lar ham yuklanadi: sarlavha
sifatida slug, sinf — kitob slug'idagi son.
"""

from __future__ import annotations

import re

from apps.content.management.commands.seed_subjects import SUBJECTS

AUTHOR = {"uz": "Mualliflar jamoasi", "ru": "Коллектив авторов", "en": "Team of authors"}


def _edition(number: int) -> dict[str, str]:
    ordinal = {1: "1st", 2: "2nd", 3: "3rd"}[number]
    return {"uz": f"{number}-nashr", "ru": f"{number}-е издание", "en": f"{ordinal} edition"}


BOOKS: dict[str, dict] = {
    "algebra-9": {
        "title": {"uz": "Algebra. 9-sinf", "ru": "Алгебра. 9 класс", "en": "Algebra. Grade 9"},
        "year": 2019,
        "edition": _edition(3),
    },
    "geometry-9": {
        "title": {
            "uz": "Geometriya. 9-sinf",
            "ru": "Геометрия. 9 класс",
            "en": "Geometry. Grade 9",
        },
        "year": 2019,
        "edition": _edition(3),
    },
    "english-9": {
        "title": {
            "uz": "Ingliz tili. 9-sinf",
            "ru": "Английский язык. 9 класс",
            "en": "English. Grade 9",
        },
        "year": 2020,
        "edition": _edition(2),
    },
    "history-9": {
        "title": {
            "uz": "O'zbekiston tarixi. 9-sinf",
            "ru": "История Узбекистана. 9 класс",
            "en": "History of Uzbekistan. Grade 9",
        },
        "year": 2019,
        "edition": _edition(1),
    },
}


def subject_fields(slug: str) -> dict:
    meta = SUBJECTS.get(slug, {})
    return {
        "title": meta.get("title", {"uz": slug}),
        "icon": meta.get("icon", ""),
        "order": meta.get("order", 0),
    }


def book_fields(slug: str) -> dict:
    meta = BOOKS.get(slug, {})
    grade = re.search(r"-(\d+)$", slug)
    return {
        "title": meta.get("title", {"uz": slug}),
        "grade": int(grade.group(1)) if grade else 1,
        "author": AUTHOR,
        "edition": meta.get("edition", _edition(1)),
        "year": meta.get("year", 2020),
    }
