"""Natijalar mantig'i: "Takrorlash kerak", o'zlashtirish, davom ettirish, haftalik hisob.

Frontend `lib/progress/review.ts` va `summary.ts` bilan bir xil qoidalar:
- takrorlash kerak: mashqlarda xato qilingan (`mistakes` bo'sh emas) mavzu;
- yaxshi o'zlashtirilgan: mashqlardan o'tilgan va xato qolmagan;
- "o'qidim" (`read_status`) va "mashqdan o'tdim" (`exercise_status`) alohida.
"""

from datetime import timedelta

from django.db.models import F, Func, IntegerField, Q, Sum

from ..models import ExerciseStatus, ReadStatus, TopicProgress

WEEK = timedelta(days=7)

REVIEW, MASTERED, IN_PROGRESS = "review", "mastered", "in_progress"

_MISTAKE_COUNT = Func(F("mistakes"), function="jsonb_array_length", output_field=IntegerField())


def _no_mistakes() -> Q:
    return Q(mistakes=[])


def has_activity_q() -> Q:
    return (
        ~Q(read_status=ReadStatus.NOT_STARTED)
        | ~Q(exercise_status=ExerciseStatus.NOT_STARTED)
        | ~_no_mistakes()
    )


def finished_q() -> Q:
    return Q(read_status=ReadStatus.READ, exercise_status=ExerciseStatus.PASSED)


def needs_review(progress: TopicProgress) -> bool:
    return bool(progress.mistakes)


def mastery_of(progress: TopicProgress) -> str:
    if needs_review(progress):
        return REVIEW
    return MASTERED if progress.exercise_status == ExerciseStatus.PASSED else IN_PROGRESS


def active(user):
    return TopicProgress.objects.filter(user=user).filter(has_activity_q())


def review_queryset(user):
    """Xatosi bor mavzular: eng ko'p xato qilingani, teng bo'lsa eng yangisi birinchi."""
    return (
        TopicProgress.objects.filter(user=user)
        .exclude(_no_mistakes())
        .annotate(mistake_count=_MISTAKE_COUNT)
        .order_by("-mistake_count", "-updated_at")
    )


def pick_continue(user) -> TopicProgress | None:
    """Eng oxirgi boshlangan, hali tugamagan mavzu (tugagan, lekin xatosi borlari ham kiradi)."""
    return (
        active(user)
        .exclude(finished_q() & _no_mistakes())
        .select_related("topic__book")
        .order_by("-updated_at")
        .first()
    )


def grouped_results(user) -> dict[str, list[TopicProgress]]:
    groups: dict[str, list[TopicProgress]] = {REVIEW: [], MASTERED: [], IN_PROGRESS: []}
    for item in active(user).select_related("topic__book").order_by("-updated_at"):
        groups[mastery_of(item)].append(item)
    return groups


def weekly_summary(user, now) -> dict:
    since = now - WEEK
    base = TopicProgress.objects.filter(user=user)
    recent = active(user).filter(updated_at__gte=since)
    mistakes = recent.aggregate(total=Sum(_MISTAKE_COUNT))["total"]
    return {
        "since": since,
        "finished": recent.filter(finished_q()).count(),
        "read": base.filter(read_at__gte=since).count(),
        "exercises_passed": base.filter(passed_at__gte=since).count(),
        "mistakes": mistakes or 0,
        "active": recent.count(),
    }
