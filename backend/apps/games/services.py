"""O'yinlar mantiqi: mavzular, tasodifiy savollar, javob tokeni, oylik limit va tangalar."""

import random
import uuid
from datetime import date

from django.conf import settings
from django.core import signing
from django.db import IntegrityError, transaction
from django.db.models import Count, Q, QuerySet
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import status
from rest_framework.exceptions import APIException, NotFound

from apps.content.models import PdfBookChapter
from apps.content.pdf_services import public_pdf_books

from .models import (
    CoinReason,
    CoinTransaction,
    CoinWallet,
    GameAllowance,
    GameSession,
    Option,
    PaidWith,
    Question,
)

ANSWER_TOKEN_SALT = "games.answer"  # noqa: S105 — signing salt, sir emas
# Slug oxiridagi bo'lim id'si qismi (12 hex = 48 bit): nom qismi faqat chiroy uchun.
SLUG_ID_HEX = 12
SLUG_TITLE_MAX = 60

# --- Xatolar ---


class InvalidAnswerToken(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "invalid_answer_token"
    default_detail = "Answer token is invalid or expired."


class GameLimitReached(APIException):
    """Oylik bepul o'yinlar tugagan va tanga yetmaydi."""

    status_code = status.HTTP_403_FORBIDDEN
    default_code = "game_limit_reached"
    default_detail = "No free games left this month and not enough coins."


class SessionFinished(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_code = "session_finished"
    default_detail = "This game session is already finished."


class NotEnoughQuestions(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_code = "not_enough_questions"
    default_detail = "The topic does not have enough active questions for a game."


# --- Mavzular ---


def topic_slug(chapter: PdfBookChapter) -> str:
    """`kvadrat-tenglamalar-3f2a9c1d0b4e`: nom (ixtiyoriy) + bo'lim id'sining 12 hex boshi."""
    title = slugify(chapter.title)[:SLUG_TITLE_MAX].strip("-")
    short = chapter.pk.hex[:SLUG_ID_HEX]
    return f"{title}-{short}" if title else short


def _slug_id_prefix(slug: str) -> str | None:
    """Slug oxiridagi hex → UUID matn ko'rinishidagi prefiks (`xxxxxxxx-xxxx`)."""
    short = slug.rsplit("-", 1)[-1].lower()
    if len(short) != SLUG_ID_HEX or any(ch not in "0123456789abcdef" for ch in short):
        return None
    return f"{short[:8]}-{short[8:]}"


def playable_topics() -> QuerySet[PdfBookChapter]:
    """O'yin uchun yetarli faol savoli bor, nashr qilingan kitobdagi bo'limlar."""
    return (
        PdfBookChapter.objects.filter(book__in=public_pdf_books())
        .annotate(question_count=Count("questions", filter=Q(questions__is_active=True)))
        .filter(question_count__gte=settings.GAMES_MIN_QUESTIONS)
        .select_related("book", "book__subject")
    )


def search_topics(query: str = "", grade: int | None = None, subject: str = ""):
    topics = playable_topics()
    if grade is not None:
        topics = topics.filter(book__grade=grade)
    if subject:
        topics = topics.filter(book__subject__slug=subject)
    query = query.strip()
    if query:
        condition = Q()
        # Lotin va kirill yozuvi: uz-Cyrl matnlari bazada lotinda (frontend runtime'da o'giradi).
        for term in {query, cyr_to_lat(query)}:
            condition |= (
                Q(title__icontains=term)
                | Q(book__title__uz__icontains=term)
                | Q(book__title__ru__icontains=term)
                | Q(book__title__en__icontains=term)
                | Q(book__subject__title__uz__icontains=term)
                | Q(book__subject__title__ru__icontains=term)
                | Q(book__subject__title__en__icontains=term)
            )
        topics = topics.filter(condition)
    return topics.order_by("book__grade", "book__subject__order", "book_id", "order", "page")


def get_playable_topic(slug: str) -> PdfBookChapter:
    prefix = _slug_id_prefix(slug)
    topic = playable_topics().filter(id__startswith=prefix).first() if prefix else None
    if topic is None:
        raise NotFound("Topic not found.")
    return topic


# --- Savollar va javob tokeni ---


def random_questions(topic: PdfBookChapter, count: int) -> list[Question]:
    """Faol savollardan tasodifiy `count` tasi; har birida variantlar ham aralashgan."""
    ids = list(topic.questions.filter(is_active=True).values_list("pk", flat=True))
    picked = random.sample(ids, min(count, len(ids)))
    by_id = {
        question.pk: question
        for question in Question.objects.filter(pk__in=picked).prefetch_related("options")
    }
    questions = [by_id[pk] for pk in picked]
    for question in questions:
        options = list(question.options.all())
        random.shuffle(options)
        question.shuffled_options = options
    return questions


def answer_token(question: Question) -> str:
    """Imzolangan token: faqat savol id'si (to'g'ri javob tokenda yo'q — u ochiq o'qiladi)."""
    return signing.dumps({"q": question.pk.hex}, salt=ANSWER_TOKEN_SALT, compress=True)


def check_answer(token: str, option_id: uuid.UUID) -> dict:
    try:
        data = signing.loads(
            token, salt=ANSWER_TOKEN_SALT, max_age=settings.GAMES_ANSWER_TOKEN_MAX_AGE
        )
        question_id = uuid.UUID(data["q"])
    except (signing.BadSignature, KeyError, TypeError, ValueError):
        raise InvalidAnswerToken() from None
    options = list(Option.objects.filter(question_id=question_id).values("pk", "is_correct"))
    if not options:
        raise InvalidAnswerToken()
    if option_id not in {option["pk"] for option in options}:
        raise InvalidAnswerToken()
    correct_id = next(option["pk"] for option in options if option["is_correct"])
    return {"correct": option_id == correct_id, "correct_option_id": correct_id}


# --- Oylik limit va tangalar ---


def current_month() -> date:
    """Joriy oy (mahalliy vaqt bo'yicha) — 1-kuni."""
    from zoneinfo import ZoneInfo

    today = timezone.now().astimezone(ZoneInfo(settings.LOCAL_TIME_ZONE)).date()
    return today.replace(day=1)


def _ensure_month(user) -> GameAllowance:
    """Oy uchun hisob yozuvi; yangi oyning birinchi murojaatida tanga bonusi beriladi."""
    month = current_month()
    allowance = GameAllowance.objects.filter(user=user, month=month).first()
    if allowance is not None:
        return allowance
    try:
        with transaction.atomic():
            allowance = GameAllowance.objects.create(user=user, month=month)
            wallet, _ = CoinWallet.objects.select_for_update().get_or_create(user=user)
            bonus = settings.GAMES_MONTHLY_COINS
            if bonus:
                CoinTransaction.objects.create(
                    user=user, amount=bonus, reason=CoinReason.MONTHLY_BONUS, month=month
                )
                wallet.balance += bonus
                wallet.save(update_fields=["balance", "updated_at"])
    except IntegrityError:
        # Parallel so'rov oyni allaqachon ochgan (bonus bir marta).
        allowance = GameAllowance.objects.get(user=user, month=month)
    return allowance


def allowance_summary(user) -> dict:
    allowance = _ensure_month(user)
    wallet, _ = CoinWallet.objects.get_or_create(user=user)
    return _summary(allowance, wallet)


def _summary(allowance: GameAllowance, wallet: CoinWallet) -> dict:
    limit = settings.GAMES_FREE_PER_MONTH
    return {
        "month": allowance.month,
        "free_games_limit": limit,
        "free_games_used": allowance.free_used,
        "free_games_left": max(limit - allowance.free_used, 0),
        "coins": wallet.balance,
        "game_cost_coins": settings.GAMES_COIN_COST,
    }


def start_session(user, game_type: str, topic: PdfBookChapter | None) -> tuple[GameSession, dict]:
    """Bitta urinishni sarflaydi: avval oylik bepul o'yin, tugagan bo'lsa tanga."""
    _ensure_month(user)
    with transaction.atomic():
        allowance = GameAllowance.objects.select_for_update().get(user=user, month=current_month())
        wallet, _ = CoinWallet.objects.select_for_update().get_or_create(user=user)
        cost = settings.GAMES_COIN_COST
        if allowance.free_used < settings.GAMES_FREE_PER_MONTH:
            allowance.free_used += 1
            allowance.save(update_fields=["free_used"])
            paid_with, spent = PaidWith.FREE, 0
        elif cost > 0 and wallet.balance >= cost:
            wallet.balance -= cost
            wallet.save(update_fields=["balance", "updated_at"])
            CoinTransaction.objects.create(
                user=user, amount=-cost, reason=CoinReason.GAME, month=allowance.month
            )
            paid_with, spent = PaidWith.COINS, cost
        else:
            raise GameLimitReached()
        session = GameSession.objects.create(
            user=user, topic=topic, game_type=game_type, paid_with=paid_with, coins_spent=spent
        )
    return session, _summary(allowance, wallet)


def finish_session(session: GameSession, data: dict) -> GameSession:
    with transaction.atomic():
        session = GameSession.objects.select_for_update().get(pk=session.pk)
        if session.finished_at is not None:
            raise SessionFinished()
        if "game_type" in data:
            session.game_type = data["game_type"]
        if "topic" in data:
            session.topic = data["topic"]
        session.teams = data["teams"]
        session.duration_seconds = data["duration_seconds"]
        session.finished_at = timezone.now()
        session.save()
    return session


def delete_user_data(user) -> None:
    """`delete_account` uchun: o'yin tarixi, limit va tangalar."""
    GameSession.objects.filter(user=user).delete()
    GameAllowance.objects.filter(user=user).delete()
    CoinTransaction.objects.filter(user=user).delete()
    CoinWallet.objects.filter(user=user).delete()


def export_user_data(user) -> dict:
    wallet = CoinWallet.objects.filter(user=user).first()
    return {
        "coins": wallet.balance if wallet else 0,
        "sessions": GameSession.objects.filter(user=user).select_related("topic"),
    }


# --- Kirill → lotin (qidiruv uchun) ---

_CYR_TO_LAT = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "yo", "ж": "j",
    "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o",
    "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "x", "ц": "ts",
    "ч": "ch", "ш": "sh", "щ": "sh", "ъ": "'", "ы": "i", "ь": "", "э": "e", "ю": "yu",
    "я": "ya", "ў": "o'", "қ": "q", "ғ": "g'", "ҳ": "h",
}  # fmt: skip


def cyr_to_lat(text: str) -> str:
    """O'zbek kirill → lotin (taxminiy, faqat qidiruv uchun; registr ahamiyatsiz)."""
    return "".join(_CYR_TO_LAT.get(ch, ch) for ch in text.lower())
