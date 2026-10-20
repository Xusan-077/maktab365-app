"""
`import_content`: frontend `src/content/{fan}/{kitob}/{bob}/{mavzu}.json` ni bazaga yuklaydi.

- Idempotent: slug bo'yicha upsert; o'zgarmagan yozuvga tegilmaydi (revision ham yaratilmaydi).
- Status saqlanadi: bazadagi status faylnikidan yuqori bo'lsa (masalan, admin `published`
  qilgan) pasaymaydi.
- Hammasi bitta tranzaksiyada: biror fayl noto'g'ri bo'lsa, hech narsa yozilmaydi.
"""

from __future__ import annotations

import json
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from django.db import transaction

from . import catalog_seed
from .models import Book, Chapter, Subject, Topic, TopicStatus
from .schemas import KEBAB_CASE, Issue, validate_chapter_file, validate_topic_file

CHAPTER_FILE = "chapter"
STATUS_RANK = {TopicStatus.DRAFT: 0, TopicStatus.REVIEWED: 1, TopicStatus.PUBLISHED: 2}


class ContentImportError(Exception):
    """Fayllarda xato: `problems` — `(fayl, Issue)` juftliklari."""

    def __init__(self, problems: list[tuple[str, Issue]]):
        self.problems = problems
        super().__init__(f"{len(problems)} ta xato")


@dataclass
class ImportReport:
    counts: Counter = field(default_factory=Counter)

    def add(self, kind: str, outcome: str) -> None:
        self.counts[(kind, outcome)] += 1

    def lines(self) -> list[str]:
        return [
            f"{kind}: {self.counts[(kind, 'created')]} yangi, "
            f"{self.counts[(kind, 'updated')]} yangilandi, "
            f"{self.counts[(kind, 'unchanged')]} o'zgarmadi"
            for kind in ("fan", "kitob", "bob", "mavzu")
        ]


@dataclass
class _File:
    key: str  # fan/kitob/bob/mavzu (kengaytmasiz)
    data: dict[str, Any]

    @property
    def parts(self) -> list[str]:
        return self.key.split("/")


def _read_tree(root: Path) -> list[_File]:
    files: list[_File] = []
    problems: list[tuple[str, Issue]] = []
    for path in sorted(root.rglob("*.json")):
        key = path.relative_to(root).with_suffix("").as_posix()
        parts = key.split("/")
        if len(parts) != 4 or not all(KEBAB_CASE.match(part) for part in parts):
            problems.append(
                (key, Issue("(yo'l)", "yo'l `fan/kitob/bob/mavzu` (kebab-case) bo'lishi kerak"))
            )
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as error:
            problems.append((key, Issue("(JSON)", str(error))))
            continue
        is_chapter = parts[-1] == CHAPTER_FILE
        issues = validate_chapter_file(data) if is_chapter else validate_topic_file(data)
        problems.extend((key, issue) for issue in issues)
        files.append(_File(key, data))

    chapters = {"/".join(f.parts[:3]) for f in files if f.parts[-1] == CHAPTER_FILE}
    for f in files:
        if "/".join(f.parts[:3]) not in chapters:
            problems.append((f.key, Issue("(papka)", "bobda chapter.json yo'q")))
    if problems:
        raise ContentImportError(problems)
    return files


def _sync(model, lookup: dict, values: dict, report: ImportReport, kind: str, *, create_only=None):
    """Upsert: `(obj, outcome)`. `create_only` — faqat yaratishda beriladigan maydonlar."""
    obj = model.objects.filter(**lookup).first()
    if obj is None:
        obj = model(**lookup, **values, **(create_only or {}))
        obj.save()
        report.add(kind, "created")
        return obj
    changed = [name for name, value in values.items() if getattr(obj, name) != value]
    if changed:
        for name in changed:
            setattr(obj, name, values[name])
        obj.save()
        report.add(kind, "updated")
    else:
        report.add(kind, "unchanged")
    return obj


def _summary_of(blocks: list[dict[str, Any]]) -> dict[str, str]:
    goal = next((block for block in blocks if block["type"] == "goal"), None)
    return dict(goal["text"]) if goal else {"uz": ""}


def _import_topic(chapter: Chapter, slug: str, data: dict[str, Any], report: ImportReport) -> None:
    file_status = TopicStatus(data["status"])
    values = {
        "title": data["title"],
        "summary": _summary_of(data["blocks"]),
        "blocks": data["blocks"],
        "notes": "\n".join(data.get("notes") or []),
        "order": data["order"],
        "chapter": chapter,
    }
    topic = Topic.objects.filter(chapter__book=chapter.book, slug=slug).first()
    if topic is None:
        topic = Topic(slug=slug, status=file_status, **values)
        topic.revision_comment = "import"
        topic.save()
        report.add("mavzu", "created")
        return
    changed = [name for name, value in values.items() if getattr(topic, name) != value]
    if STATUS_RANK[file_status] > STATUS_RANK[TopicStatus(topic.status)]:
        topic.status = file_status
        changed.append("status")
    if not changed:
        report.add("mavzu", "unchanged")
        return
    for name in changed:
        if name != "status":
            setattr(topic, name, values[name])
    topic.revision_comment = "import"
    topic.save()
    report.add("mavzu", "updated")


def import_content(root: Path, *, dry_run: bool = False) -> ImportReport:
    files = _read_tree(root)
    report = ImportReport()
    with transaction.atomic():
        subjects: dict[str, Subject] = {}
        books: dict[str, Book] = {}
        chapters: dict[str, Chapter] = {}
        # Boblar topiclardan oldin, topiclar tartib bo'yicha.
        for f in sorted(files, key=lambda f: (f.parts[-1] != CHAPTER_FILE, f.key)):
            subject_slug, book_slug, chapter_slug, name = f.parts
            if subject_slug not in subjects:
                subjects[subject_slug] = _sync(
                    Subject,
                    {"slug": subject_slug},
                    catalog_seed.subject_fields(subject_slug),
                    report,
                    "fan",
                )
            if book_slug not in books:
                books[book_slug] = _sync(
                    Book,
                    {"slug": book_slug},
                    {**catalog_seed.book_fields(book_slug), "subject": subjects[subject_slug]},
                    report,
                    "kitob",
                    create_only={"is_published": True},
                )
            chapter_key = f"{book_slug}/{chapter_slug}"
            if name == CHAPTER_FILE:
                chapters[chapter_key] = _sync(
                    Chapter,
                    {"book": books[book_slug], "slug": chapter_slug},
                    {"title": f.data["title"], "order": f.data["order"]},
                    report,
                    "bob",
                )
            else:
                _import_topic(chapters[chapter_key], name, f.data, report)
        Book.objects.filter(pk__in=[b.pk for b in books.values()]).update(topics_ready=True)
        if dry_run:
            transaction.set_rollback(True)
    return report
