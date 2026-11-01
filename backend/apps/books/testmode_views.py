"""Test kitoblar rejimi, o'quvchi tomoni (`/me/books/<id>/test/...`).

Javoblar kaliti bu yerdan HECH QACHON chiqmaydi: faqat savollar ro'yxati va tekshirishdan keyin
har savol uchun to'g'ri/xato.
"""

from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsLearner

from . import testmode
from .me_views import valid_page
from .models import AnswerAttempt, AnswerKeyItem, BookType, SheetAnswer
from .views import visible_book

TAGS = ["books"]
ATTEMPTS_LIMIT = 50


def test_book(request, pk):
    """Ko'rinadigan test kitobi; boshqa tur uchun rejim yo'q (404)."""
    book = visible_book(request, pk)
    if book.type != BookType.TEST:
        raise NotFound
    return book


class AnswerSheetQuestionSerializer(serializers.Serializer):
    page = serializers.IntegerField()
    question = serializers.IntegerField()
    kind = serializers.ChoiceField(choices=["choice", "text"])


class AnswerSheetEntrySerializer(serializers.Serializer):
    page = serializers.IntegerField()
    question = serializers.IntegerField()
    answer = serializers.CharField()


class AnswerSheetSerializer(serializers.Serializer):
    questions = AnswerSheetQuestionSerializer(many=True)
    choices = serializers.IntegerField(help_text="Variantlar soni (A–D yoki A–E)")
    answers = AnswerSheetEntrySerializer(many=True)


class AnswerSheetWriteSerializer(serializers.Serializer):
    page = serializers.IntegerField(min_value=1)
    question = serializers.IntegerField(min_value=1, max_value=testmode.QUESTION_MAX)
    answer = serializers.CharField(
        allow_blank=True, trim_whitespace=True, max_length=testmode.ANSWER_MAX
    )


class AnswerAttemptItemSerializer(serializers.Serializer):
    page = serializers.IntegerField()
    question = serializers.IntegerField()
    correct = serializers.BooleanField()
    given = serializers.CharField(allow_null=True)


class AnswerAttemptSummarySerializer(serializers.Serializer):
    id = serializers.UUIDField()
    created_at = serializers.DateTimeField()
    score = serializers.IntegerField()
    total = serializers.IntegerField()


class AnswerAttemptDetailSerializer(AnswerAttemptSummarySerializer):
    items = AnswerAttemptItemSerializer(many=True)


def _detail(attempt: AnswerAttempt) -> dict:
    return {
        "id": attempt.pk,
        "created_at": attempt.created_at,
        "score": attempt.score,
        "total": attempt.total,
        "items": attempt.results,
    }


class MyTestSheetView(APIView):
    permission_classes = [IsLearner]

    @extend_schema(
        operation_id="me_books_test_sheet",
        tags=TAGS,
        summary="Test: savollar ro'yxati va mening javoblarim (kalitsiz)",
        responses=AnswerSheetSerializer,
    )
    def get(self, request, pk):
        book = test_book(request, pk)
        mine = SheetAnswer.objects.filter(user=request.user, book=book).order_by("page", "question")
        return Response(
            {
                "questions": testmode.questions(book),
                "choices": testmode.choice_count(book),
                "answers": [
                    {"page": row.page, "question": row.question, "answer": row.answer}
                    for row in mine
                ],
            }
        )


class MyTestAnswerView(APIView):
    permission_classes = [IsLearner]

    @extend_schema(
        operation_id="me_books_test_answer",
        tags=TAGS,
        summary="Javob varag'iga javob yozish (idempotent; bo'sh javob o'chiradi)",
        request=AnswerSheetWriteSerializer,
        responses=AnswerSheetEntrySerializer,
    )
    def put(self, request, pk):
        serializer = AnswerSheetWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        book = test_book(request, pk)
        data = serializer.validated_data
        page = valid_page(book, data["page"])
        if not AnswerKeyItem.objects.filter(
            book=book, page=page, question=data["question"]
        ).exists():
            raise ValidationError({"question": ["unknown_question"]})
        mine = SheetAnswer.objects.filter(
            user=request.user, book=book, page=page, question=data["question"]
        )
        answer = testmode.display_answer(data["answer"])
        if not answer:
            mine.delete()
        else:
            SheetAnswer.objects.update_or_create(
                user=request.user,
                book=book,
                page=page,
                question=data["question"],
                defaults={"answer": answer},
            )
        return Response({"page": page, "question": data["question"], "answer": answer})


class MyTestCheckView(APIView):
    permission_classes = [IsLearner]

    @extend_schema(
        operation_id="me_books_test_check",
        tags=TAGS,
        summary="Tekshirish: kalit bo'yicha ball (kalitning o'zi yuborilmaydi)",
        request=None,
        responses={201: AnswerAttemptDetailSerializer},
    )
    def post(self, request, pk):
        book = test_book(request, pk)
        if not AnswerKeyItem.objects.filter(book=book).exists():
            raise ValidationError({"detail": ["no_answer_key"]})
        if not SheetAnswer.objects.filter(user=request.user, book=book).exists():
            raise ValidationError({"detail": ["no_answers"]})
        attempt = testmode.grade(book, request.user)
        return Response(_detail(attempt), status=status.HTTP_201_CREATED)


class MyTestAttemptsView(APIView):
    permission_classes = [IsLearner]

    @extend_schema(
        operation_id="me_books_test_attempts",
        tags=TAGS,
        summary="Urinishlar tarixi (sana, ball), yangisi birinchi",
        responses=AnswerAttemptSummarySerializer(many=True),
    )
    def get(self, request, pk):
        book = test_book(request, pk)
        rows = AnswerAttempt.objects.filter(user=request.user, book=book)[:ATTEMPTS_LIMIT]
        return Response(
            [
                {"id": r.pk, "created_at": r.created_at, "score": r.score, "total": r.total}
                for r in rows
            ]
        )


class MyTestAttemptDetailView(APIView):
    permission_classes = [IsLearner]

    @extend_schema(
        operation_id="me_books_test_attempt",
        tags=TAGS,
        summary="Bitta urinish: har savol uchun to'g'ri/xato",
        responses=AnswerAttemptDetailSerializer,
    )
    def get(self, request, pk, attempt_id):
        book = test_book(request, pk)
        attempt = AnswerAttempt.objects.filter(pk=attempt_id, user=request.user, book=book).first()
        if attempt is None:
            raise NotFound
        return Response(_detail(attempt))
