from django.db import transaction
from django.db.models import Max
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts import audit
from apps.content.admin_views import AdminViewSet, IsEditor
from apps.content.models import PdfBookChapter

from .admin_serializers import (
    QuestionAdminSerializer,
    QuestionImportRequestSerializer,
    QuestionImportResultSerializer,
    QuestionReorderRequestSerializer,
    write_options,
)
from .models import Question

TAG = ["admin"]
TARGET = "question"
SNAPSHOT_FIELDS = ("text", "difficulty", "order", "is_active", "image")


def _label(question: Question) -> str:
    return question.text.get("uz", "")[:60]


def _questions(topic):
    return topic.questions.prefetch_related("options").order_by("order", "created_at")


class TopicMixin:
    permission_classes = [IsEditor]

    def get_topic(self) -> PdfBookChapter:
        # Staff har qanday statusdagi kitob bo'limiga savol qo'sha oladi (qoralama ham).
        return get_object_or_404(PdfBookChapter, pk=self.kwargs["topic_id"])


class TopicQuestionsView(TopicMixin, APIView):
    @extend_schema(
        operation_id="admin_topic_questions_list",
        tags=TAG,
        responses=QuestionAdminSerializer(many=True),
        summary="Mavzu savollari (hammasi, nofaollari ham), tartib bo'yicha",
    )
    def get(self, request, topic_id):
        topic = self.get_topic()
        return Response(QuestionAdminSerializer(_questions(topic), many=True).data)

    @extend_schema(
        operation_id="admin_topic_questions_create",
        tags=TAG,
        request=QuestionAdminSerializer,
        responses={201: QuestionAdminSerializer},
    )
    def post(self, request, topic_id):
        topic = self.get_topic()
        body = QuestionAdminSerializer(data=request.data, context={"topic": topic})
        body.is_valid(raise_exception=True)
        with transaction.atomic():
            question = body.save()
            audit.record(
                request.user,
                "create",
                TARGET,
                question.pk,
                label=_label(question),
                after=audit.snapshot(question, SNAPSHOT_FIELDS),
                request=request,
            )
        return Response(QuestionAdminSerializer(question).data, status=201)


class TopicQuestionsReorderView(TopicMixin, APIView):
    @extend_schema(
        operation_id="admin_topic_questions_reorder",
        tags=TAG,
        request=QuestionReorderRequestSerializer,
        responses=QuestionAdminSerializer(many=True),
        summary="Tartib: mavzuning barcha savollari aynan bir martadan, yangi tartibda",
    )
    def post(self, request, topic_id):
        topic = self.get_topic()
        body = QuestionReorderRequestSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        ids = body.validated_data["ids"]
        existing = set(topic.questions.values_list("pk", flat=True))
        if len(ids) != len(set(ids)) or set(ids) != existing:
            raise serializers.ValidationError({"ids": ["ids_mismatch"]})
        with transaction.atomic():
            rows = {q.pk: q for q in topic.questions.select_for_update()}
            for order, pk in enumerate(ids):
                rows[pk].order = order
            Question.objects.bulk_update(rows.values(), ["order"])
            audit.record(
                request.user, "reorder", TARGET, topic.pk, label=topic.title, request=request
            )
        return Response(QuestionAdminSerializer(_questions(topic), many=True).data)


class TopicQuestionsImportView(TopicMixin, APIView):
    @extend_schema(
        operation_id="admin_topic_questions_import",
        tags=TAG,
        request=QuestionImportRequestSerializer,
        responses=QuestionImportResultSerializer,
        summary="Ommaviy import (hammasi yoki hech biri); `dry_run` — faqat tekshirish",
    )
    def post(self, request, topic_id):
        topic = self.get_topic()
        body = QuestionImportRequestSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        items = body.validated_data["questions"]
        if body.validated_data["dry_run"]:
            return Response({"created": len(items), "dry_run": True})
        with transaction.atomic():
            last = topic.questions.aggregate(last=Max("order"))["last"]
            start = 0 if last is None else last + 1
            for index, item in enumerate(items):
                options = item.pop("options")
                question = Question.objects.create(topic=topic, order=start + index, **item)
                write_options(question, options)
            audit.record(
                request.user,
                "import",
                TARGET,
                topic.pk,
                label=topic.title,
                after={"count": len(items)},
                request=request,
            )
        return Response({"created": len(items), "dry_run": False})


@extend_schema_view(
    retrieve=extend_schema(operation_id="admin_questions_retrieve", tags=TAG),
    partial_update=extend_schema(operation_id="admin_questions_update", tags=TAG),
    destroy=extend_schema(operation_id="admin_questions_delete", tags=TAG),
)
class QuestionAdminViewSet(AdminViewSet):
    """Bitta savol: tahrirlash (variantlar bilan), faol/nofaol, o'chirish (faqat admin).
    Ro'yxat va yaratish mavzu ostida (`topics/{id}/questions/`), shuning uchun `list` ulanmagan."""

    target_type = TARGET
    snapshot_fields = SNAPSHOT_FIELDS
    serializer_class = QuestionAdminSerializer
    http_method_names = ["get", "patch", "delete", "head", "options"]
    queryset = Question.objects.prefetch_related("options")
    filter_backends: list = []

    def label(self, instance) -> str:
        return _label(instance)
