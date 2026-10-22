"""Shaxsiy rejalar (`me/goals/`)."""

from django.db.models import F
from django.utils import timezone
from rest_framework.exceptions import APIException

from ..models import StudyGoal

GOALS_LIMIT = 100


class GoalsLimitReached(APIException):
    status_code = 409
    default_code = "goals_limit_reached"
    default_detail = "Too many goals."


def user_goals(user):
    """Bajarilmaganlar birinchi; ular ichida muddati yaqini, muddatsizlari oxirida."""
    return (
        StudyGoal.objects.filter(user=user)
        .select_related("pdf_book__subject")
        .order_by(
            F("done_at").asc(nulls_first=True),
            F("due_date").asc(nulls_last=True),
            "-created_at",
        )
    )


def create_goal(user, *, title, pdf_book=None, due_date=None) -> StudyGoal:
    if StudyGoal.objects.filter(user=user).count() >= GOALS_LIMIT:
        raise GoalsLimitReached()
    return StudyGoal.objects.create(user=user, title=title, pdf_book=pdf_book, due_date=due_date)


def set_done(goal: StudyGoal, done: bool) -> None:
    """Idempotent: bajarilgan reja qayta belgilansa vaqti o'zgarmaydi."""
    if done and goal.done_at is None:
        goal.done_at = timezone.now()
    elif not done:
        goal.done_at = None
