"""Test mantiqi: nested yozish, javoblarni serverda tekshirish, nusxalash."""

from django.db import transaction
from django.db.models import Q
from rest_framework.exceptions import NotFound, ValidationError

from .models import (
    TITLE_MAX,
    Quiz,
    QuizAttempt,
    QuizCategory,
    QuizOption,
    QuizQuestion,
    Visibility,
)

MAX_TIME_SPENT = 24 * 60 * 60
COPY_SUFFIX = " (nusxa)"


def categories_for(teacher):
    """Tayyor kategoriyalar + ustozning o'ziniki."""
    return QuizCategory.objects.filter(Q(teacher__isnull=True) | Q(teacher=teacher))


def _sync_options(question: QuizQuestion, options: list[dict]) -> None:
    """Variantlarni joyida yozadi (berilgan `id` saqlanadi, tushib qolganlari o'chadi)."""
    # Avval to'g'ri belgisini olib tashlaymiz: "bitta to'g'ri" cheklovi oraliq holatda buzilmasin.
    question.options.update(is_correct=False)
    existing = {option.pk: option for option in question.options.all()}
    keep: set = set()
    for order, data in enumerate(options):
        option = existing.get(data.get("id")) or QuizOption(question=question)
        option.text = data["text"]
        option.is_correct = data["is_correct"]
        option.order = order
        option.save()
        keep.add(option.pk)
    question.options.exclude(pk__in=keep).delete()


def _sync_questions(quiz: Quiz, questions: list[dict]) -> None:
    existing = {question.pk: question for question in quiz.questions.all()}
    keep: set = set()
    for order, data in enumerate(questions):
        question = existing.get(data.get("id")) or QuizQuestion(quiz=quiz)
        question.text = data["text"]
        question.order = order
        if "image" in data:
            question.image = data["image"] or None
        question.save()
        _sync_options(question, data["options"])
        keep.add(question.pk)
    quiz.questions.exclude(pk__in=keep).delete()


@transaction.atomic
def save_quiz(serializer, teacher) -> Quiz:
    """Nested yozish: `serializer.validated_data` dan test, savollar va variantlar."""
    data = dict(serializer.validated_data)
    questions = data.pop("questions", None)
    if "cover_image" in data:
        data["cover_image"] = data["cover_image"] or None
    if serializer.instance is None:
        quiz = Quiz.objects.create(teacher=teacher, **data)
    else:
        quiz = serializer.instance
        for field, value in data.items():
            setattr(quiz, field, value)
        quiz.save()
    if questions is not None:
        _sync_questions(quiz, questions)
    # Faqat savollar o'zgargan bo'lsa ham `updated_at` yangilansin.
    quiz.save(update_fields=["updated_at"])
    return quiz


@transaction.atomic
def duplicate_quiz(quiz: Quiz) -> Quiz:
    """Nusxa har doim shaxsiy (private) bo'ladi; urinishlar ko'chirilmaydi."""
    title = f"{quiz.title[: TITLE_MAX - len(COPY_SUFFIX)]}{COPY_SUFFIX}"
    copy = Quiz.objects.create(
        teacher=quiz.teacher,
        title=title,
        description=quiz.description,
        category=quiz.category,
        cover_image=quiz.cover_image or None,
        visibility=Visibility.PRIVATE,
        time_per_question=quiz.time_per_question,
        shuffle_questions=quiz.shuffle_questions,
        shuffle_options=quiz.shuffle_options,
    )
    for question in quiz.questions.prefetch_related("options"):
        new_question = QuizQuestion.objects.create(
            quiz=copy, text=question.text, image=question.image or None, order=question.order
        )
        QuizOption.objects.bulk_create(
            QuizOption(question=new_question, text=o.text, is_correct=o.is_correct, order=o.order)
            for o in question.options.all()
        )
    return copy


def get_public_quiz(quiz_id) -> Quiz:
    quiz = (
        Quiz.objects.filter(pk=quiz_id, visibility=Visibility.PUBLIC)
        .select_related("category")
        .prefetch_related("questions__options")
        .first()
    )
    if quiz is None:
        raise NotFound("Quiz not found.")
    return quiz


def check_answer(quiz: Quiz, question_id, option_id) -> dict:
    """Bitta javobni tekshiradi (ochiq test): natija saqlanmaydi."""
    question = quiz.questions.filter(pk=question_id).first()
    if question is None:
        raise ValidationError({"question_id": ["invalid_question"]})
    options = list(question.options.all())
    if not any(o.pk == option_id for o in options):
        raise ValidationError({"option_id": ["invalid_option"]})
    correct = next(o for o in options if o.is_correct)
    return {"correct": correct.pk == option_id, "correct_option_id": correct.pk}


@transaction.atomic
def create_attempt(quiz: Quiz, teacher, answers: list[dict], time_spent: int) -> QuizAttempt:
    """Javoblarni serverda tekshiradi va ballni hisoblaydi (javobsiz savol — noto'g'ri)."""
    questions = list(quiz.questions.prefetch_related("options"))
    by_id = {q.pk: q for q in questions}
    given: dict = {}
    for answer in answers:
        question = by_id.get(answer["question_id"])
        if question is None:
            raise ValidationError({"answers": ["invalid_question"]})
        if answer["question_id"] in given:
            raise ValidationError({"answers": ["duplicate_question"]})
        option_id = answer["option_id"]
        if option_id is not None and not any(o.pk == option_id for o in question.options.all()):
            raise ValidationError({"answers": ["invalid_option"]})
        given[answer["question_id"]] = option_id

    review = []
    score = 0
    for question in questions:
        options = list(question.options.all())
        correct = next((o for o in options if o.is_correct), None)
        chosen = next((o for o in options if o.pk == given.get(question.pk)), None)
        is_correct = chosen is not None and correct is not None and chosen.pk == correct.pk
        score += is_correct
        review.append(
            {
                "question_id": str(question.pk),
                "question": question.text,
                "option_id": str(chosen.pk) if chosen else None,
                "option_text": chosen.text if chosen else None,
                "correct_option_id": str(correct.pk) if correct else None,
                "correct_option_text": correct.text if correct else None,
                "correct": is_correct,
            }
        )
    return QuizAttempt.objects.create(
        quiz=quiz,
        teacher=teacher,
        score=score,
        total=len(questions),
        time_spent=min(max(time_spent, 0), MAX_TIME_SPENT),
        answers=review,
    )
