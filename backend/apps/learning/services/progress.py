"""Progressni yozish qoidalari.

`apply_update` (PUT) — idempotent va monoton: holatlar pasaymaydi, yechilgan mashqlar va urinishlar
faqat o'sadi; `last_block_id`, `scroll_position`, `mistakes` esa faqat yangiroq mijoz yozuvidan
(`updated_at`) olinadi. `apply_event` — bitta voqea (ochildi/o'qildi/javob berildi).
`merge_progress` — mehmon ma'lumotini qo'shish (frontend `merge-guest-data.ts` bilan bir xil qoida).
"""

import json
from collections.abc import Callable
from datetime import datetime

from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.content.models import Topic

from ..models import (
    EXERCISE_RANK,
    READ_RANK,
    RECENT_LIMIT,
    ExerciseStatus,
    ReadStatus,
    RecentView,
    TopicProgress,
)
from .topics import exercise_ids

TRACKED = (
    "read_status",
    "exercise_status",
    "last_block_id",
    "scroll_position",
    "mistakes",
    "exercise_stats",
    "first_opened_at",
    "read_at",
    "passed_at",
    "client_updated_at",
)


class UnknownExercise(Exception):
    """Voqeadagi mashq id'si mavzuda yo'q."""


def _comparable(value):
    # Bir xil lahza turli zonada yozilsa ham teng (DB UTC, DRF joriy zona); JSON kalit tartibi
    # (jsonb saralaydi) hisobga olinmaydi.
    if isinstance(value, datetime):
        return value.timestamp()
    if isinstance(value, dict | list):
        return json.dumps(value, sort_keys=True)
    return value


def _snapshot(progress: TopicProgress) -> tuple:
    return tuple(repr(_comparable(getattr(progress, name))) for name in TRACKED)


def _higher(rank: dict, current: str, incoming: str | None) -> str:
    return incoming if incoming and rank[incoming] > rank[current] else current


def _iso(value) -> str:
    return value.isoformat() if hasattr(value, "isoformat") else str(value)


def normalize_mistakes(items) -> list[dict]:
    """Mashq bo'yicha birlashtiradi: eng ko'p urinish, eng so'nggi xato vaqti."""
    merged: dict[str, dict] = {}
    for item in items or []:
        exercise_id = item["exercise_id"]
        attempts = max(1, int(item.get("attempts") or 1))
        wrong_at = _iso(item["last_wrong_at"]) if item.get("last_wrong_at") else None
        current = merged.get(exercise_id)
        if current is None:
            merged[exercise_id] = {
                "exercise_id": exercise_id,
                "attempts": attempts,
                "last_wrong_at": wrong_at,
            }
            continue
        current["attempts"] = max(current["attempts"], attempts)
        if wrong_at and (current["last_wrong_at"] or "") < wrong_at:
            current["last_wrong_at"] = wrong_at
    return list(merged.values())


def merge_stats(current: dict, incoming: dict | None) -> dict:
    """Yechilganlar birlashmasi, urinishlar mashq bo'yicha eng kattasi (faqat o'sadi)."""
    incoming = incoming or {}
    solved = list(dict.fromkeys([*current.get("solved", []), *incoming.get("solved", [])]))
    attempts = dict(current.get("attempts", {}))
    for exercise_id, count in (incoming.get("attempts") or {}).items():
        attempts[exercise_id] = max(attempts.get(exercise_id, 0), count)
    return {"solved": solved, "attempts": attempts}


def _stamp(progress: TopicProgress, now) -> None:
    started = (
        progress.read_status != ReadStatus.NOT_STARTED
        or progress.exercise_status != ExerciseStatus.NOT_STARTED
    )
    if started and progress.first_opened_at is None:
        progress.first_opened_at = now
    if progress.read_status == ReadStatus.READ and progress.read_at is None:
        progress.read_at = now
    if progress.exercise_status == ExerciseStatus.PASSED and progress.passed_at is None:
        progress.passed_at = now


def _client_time(value, now):
    """Mijoz vaqti kelajakda bo'lmasin (soati noto'g'ri qurilma yangi yozuvlarni bloklamasin)."""
    return min(value, now) if value else now


def _is_fresh(progress: TopicProgress, ts) -> bool:
    return progress.client_updated_at is None or ts >= progress.client_updated_at


def _is_newer(progress: TopicProgress, ts) -> bool:
    """Mehmon yozuvi akkaunt yozuvidan qat'iy yangiroq (teng bo'lsa akkaunt qoladi)."""
    current = progress.client_updated_at or progress.updated_at
    return current is None or ts > current


def _locked(user, topic: Topic) -> TopicProgress:
    """Qatorni qulflab oladi (yo'q bo'lsa saqlanmagan nusxa). Atomic blok ichida chaqiriladi."""
    try:
        return TopicProgress.objects.select_for_update().get(user=user, topic=topic)
    except TopicProgress.DoesNotExist:
        return TopicProgress(user=user, topic=topic)


def _write(
    user, topic: Topic, mutate: Callable[[TopicProgress], None]
) -> tuple[TopicProgress, bool]:
    """`mutate` ni qulf ostida qo'llaydi; faqat o'zgargan bo'lsa saqlaydi (takror yozuv
    `updated_at` ni siljitmaydi, bo'sh yozuv qator yaratmaydi). `(progress, o'zgardimi)`."""
    for attempt in (1, 2):
        try:
            with transaction.atomic():
                progress = _locked(user, topic)
                before = _snapshot(progress)
                mutate(progress)
                changed = _snapshot(progress) != before
                if changed:
                    progress.save()
                return progress, changed
        except IntegrityError:
            # Ikki so'rov bir vaqtda birinchi qatorni yaratmoqchi bo'ldi: ikkinchisi qayta o'qiydi.
            if attempt == 2:
                raise
    raise AssertionError("unreachable")


def apply_update(user, topic: Topic, data: dict) -> TopicProgress:
    """PUT: to'liq holat; takror yuborilsa natija o'zgarmaydi."""
    now = timezone.now()

    def mutate(progress: TopicProgress) -> None:
        progress.read_status = _higher(READ_RANK, progress.read_status, data.get("read_status"))
        progress.exercise_status = _higher(
            EXERCISE_RANK, progress.exercise_status, data.get("exercise_status")
        )
        if "exercise_stats" in data:
            progress.exercise_stats = merge_stats(progress.exercise_stats, data["exercise_stats"])

        ts = _client_time(data.get("updated_at"), now)
        has_tracked = any(name in data for name in ("last_block_id", "scroll_position", "mistakes"))
        if has_tracked and _is_fresh(progress, ts):
            if "last_block_id" in data:
                progress.last_block_id = data["last_block_id"]
            if "scroll_position" in data:
                progress.scroll_position = data["scroll_position"]
            if "mistakes" in data:
                progress.mistakes = normalize_mistakes(data["mistakes"])
            progress.client_updated_at = ts
        _stamp(progress, now)

    return _write(user, topic, mutate)[0]


def record_recent(user, topic: Topic, now) -> None:
    RecentView.objects.update_or_create(user=user, topic=topic, defaults={"viewed_at": now})
    stale = RecentView.objects.filter(user=user).order_by("-viewed_at")[RECENT_LIMIT:]
    RecentView.objects.filter(pk__in=list(stale.values_list("pk", flat=True))).delete()


def apply_event(user, topic: Topic, event: dict) -> TopicProgress:
    """POST events: bitta voqea. `exercise_answered` takror yuborilsa urinishlar o'sadi (voqea)."""
    now = timezone.now()
    kind = event["type"]
    exercises = exercise_ids(topic)
    if kind == "exercise_answered" and event["exercise_id"] not in exercises:
        raise UnknownExercise(event["exercise_id"])

    def mutate(progress: TopicProgress) -> None:
        if kind == "topic_opened":
            progress.read_status = _higher(READ_RANK, progress.read_status, ReadStatus.IN_PROGRESS)
        elif kind == "topic_read":
            progress.read_status = ReadStatus.READ
            if event.get("last_block_id") and _is_fresh(progress, now):
                progress.last_block_id = event["last_block_id"]
                progress.client_updated_at = now
        else:
            _answer(progress, event, exercises, now)
        _stamp(progress, now)

    progress, _ = _write(user, topic, mutate)
    if kind == "topic_opened":
        record_recent(user, topic, now)
    return progress


def _answer(progress: TopicProgress, event: dict, exercises: list[str], now) -> None:
    exercise_id = event["exercise_id"]
    stats = merge_stats(progress.exercise_stats, None)
    stats["attempts"][exercise_id] = stats["attempts"].get(exercise_id, 0) + 1
    mistakes = normalize_mistakes(progress.mistakes)

    if event["correct"]:
        if exercise_id not in stats["solved"]:
            stats["solved"].append(exercise_id)
        # Xato faqat ochilishdagi birinchi urinishda to'g'ri yechilsa o'chadi.
        if event.get("attempt", 1) == 1:
            mistakes = [m for m in mistakes if m["exercise_id"] != exercise_id]
    else:
        entry = next((m for m in mistakes if m["exercise_id"] == exercise_id), None)
        if entry is None:
            mistakes.append({"exercise_id": exercise_id, "attempts": 1, "last_wrong_at": _iso(now)})
        else:
            entry["attempts"] += 1
            entry["last_wrong_at"] = _iso(now)

    progress.exercise_stats = stats
    progress.mistakes = mistakes
    done = bool(exercises) and all(e in stats["solved"] for e in exercises)
    progress.exercise_status = _higher(
        EXERCISE_RANK,
        progress.exercise_status,
        ExerciseStatus.PASSED if done else ExerciseStatus.IN_PROGRESS,
    )


def merge_progress(user, topic: Topic, guest: dict) -> bool:
    """Mehmon yozuvini akkauntga qo'shadi: holatlar eng yuqorisi, xatolar birlashmasi,
    `last_block_id` — yangiroq yozuvniki. O'zgarish bo'lsa `True` (takror chaqirilsa `False`)."""
    now = timezone.now()

    def mutate(progress: TopicProgress) -> None:
        progress.read_status = _higher(READ_RANK, progress.read_status, guest.get("read_status"))
        progress.exercise_status = _higher(
            EXERCISE_RANK, progress.exercise_status, guest.get("exercise_status")
        )
        progress.exercise_stats = merge_stats(progress.exercise_stats, guest.get("exercise_stats"))
        if guest.get("mistakes"):
            progress.mistakes = normalize_mistakes([*progress.mistakes, *guest["mistakes"]])

        ts = _client_time(guest.get("updated_at"), now)
        if guest.get("last_block_id") and (not progress.last_block_id or _is_newer(progress, ts)):
            progress.last_block_id = guest["last_block_id"]
            if guest.get("scroll_position") is not None:
                progress.scroll_position = guest["scroll_position"]
            progress.client_updated_at = ts
        _stamp(progress, now)

    return _write(user, topic, mutate)[1]
