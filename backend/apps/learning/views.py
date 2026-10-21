from django.db import transaction
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers, status
from rest_framework.exceptions import APIException, NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsRole

from .models import Bookmark, BookmarkKind, RecentView, StudyGoal, TopicProgress
from .serializers import (
    GOAL_LIMIT,
    BookmarkSerializer,
    BookmarkWriteSerializer,
    DashboardSerializer,
    EventSerializer,
    MergeRequestSerializer,
    MergeResultSerializer,
    ProgressWriteSerializer,
    RecentViewSerializer,
    ResultsSerializer,
    StudyGoalPatchSerializer,
    StudyGoalSerializer,
    StudyGoalWriteSerializer,
    TeacherDashboardSerializer,
    TopicProgressSerializer,
)
from .services import dashboard
from .services import progress as progress_service
from .services.bookmarks import add_bookmark, visible_book
from .services.merge import merge_guest_data
from .services.topics import key_expr, resolve_topic

TAGS = ["learning"]


class UnknownExercise(APIException):
    status_code = 400
    default_code = "unknown_exercise"
    default_detail = "The exercise does not belong to this topic."


def _progress_qs(user):
    return TopicProgress.objects.filter(user=user).select_related("topic__book")


class ProgressListView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        operation_id="me_progress_list",
        tags=TAGS,
        parameters=[
            OpenApiParameter("book", OpenApiTypes.STR, description="Kitob slug'i"),
            OpenApiParameter("topic", OpenApiTypes.STR, description="Mavzu kaliti"),
            OpenApiParameter("read_status", OpenApiTypes.STR),
            OpenApiParameter("exercise_status", OpenApiTypes.STR),
            OpenApiParameter("needs_review", OpenApiTypes.BOOL, description="Faqat xatosi borlar"),
        ],
        responses=TopicProgressSerializer(many=True),
    )
    def get(self, request):
        rows = _progress_qs(request.user).order_by("-updated_at")
        params = request.query_params
        if book := params.get("book"):
            rows = rows.filter(topic__book__slug=book)
        if topic := params.get("topic"):
            rows = rows.annotate(key=key_expr("topic__")).filter(key=topic)
        if value := params.get("read_status"):
            rows = rows.filter(read_status=value)
        if value := params.get("exercise_status"):
            rows = rows.filter(exercise_status=value)
        if params.get("needs_review") in ("1", "true", "True"):
            rows = rows.exclude(mistakes=[])
        return Response(TopicProgressSerializer(rows, many=True).data)


class ProgressDetailView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        operation_id="me_progress_retrieve",
        tags=TAGS,
        responses=TopicProgressSerializer,
    )
    def get(self, request, topic_id):
        topic = resolve_topic(request, topic_id)
        row = _progress_qs(request.user).filter(topic=topic).first()
        # Hali boshlanmagan mavzu: bo'sh holat (qator yaratilmaydi).
        row = row or TopicProgress(user=request.user, topic=topic)
        return Response(TopicProgressSerializer(row).data)

    @extend_schema(
        operation_id="me_progress_update",
        tags=TAGS,
        summary="Mavzu progressini yozish (idempotent, monoton)",
        request=ProgressWriteSerializer,
        responses=TopicProgressSerializer,
    )
    def put(self, request, topic_id):
        serializer = ProgressWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        topic = resolve_topic(request, topic_id)
        row = progress_service.apply_update(request.user, topic, serializer.validated_data)
        return Response(TopicProgressSerializer(row).data)


class EventView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        operation_id="me_events_create",
        tags=TAGS,
        summary="O'qish voqeasi: topic_opened | topic_read | exercise_answered",
        request=EventSerializer,
        responses=TopicProgressSerializer,
    )
    def post(self, request):
        serializer = EventSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        event = serializer.validated_data
        topic = resolve_topic(request, event["topic_id"])
        try:
            row = progress_service.apply_event(request.user, topic, event)
        except progress_service.UnknownExercise as error:
            raise UnknownExercise from error
        return Response(TopicProgressSerializer(row).data)


class BookmarkView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        operation_id="me_bookmarks_list",
        tags=TAGS,
        parameters=[OpenApiParameter("kind", OpenApiTypes.STR, enum=["book", "topic"])],
        responses=BookmarkSerializer(many=True),
    )
    def get(self, request):
        rows = Bookmark.objects.filter(user=request.user).select_related("topic__book", "book")
        if kind := request.query_params.get("kind"):
            rows = rows.filter(kind=kind)
        return Response(BookmarkSerializer(rows.order_by("-created_at"), many=True).data)

    @extend_schema(
        operation_id="me_bookmarks_create",
        tags=TAGS,
        summary="Xatcho'p qo'yish (takror yuborilsa 200)",
        request=BookmarkWriteSerializer,
        responses={201: BookmarkSerializer, 200: BookmarkSerializer},
    )
    def post(self, request):
        serializer = BookmarkWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if data["kind"] == BookmarkKind.TOPIC:
            bookmark, created = add_bookmark(
                request.user, topic=resolve_topic(request, data["topic_id"])
            )
        else:
            bookmark, created = add_bookmark(
                request.user, book=visible_book(request, data["book_id"])
            )
        bookmark = Bookmark.objects.select_related("topic__book", "book").get(pk=bookmark.pk)
        code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(BookmarkSerializer(bookmark).data, status=code)

    @extend_schema(
        operation_id="me_bookmarks_delete",
        tags=TAGS,
        summary="Xatcho'pni olib tashlash (yo'q bo'lsa ham 204)",
        parameters=[
            OpenApiParameter("kind", OpenApiTypes.STR, enum=["book", "topic"], required=True),
            OpenApiParameter("topic_id", OpenApiTypes.STR),
            OpenApiParameter("book_id", OpenApiTypes.STR),
        ],
        responses={204: None},
    )
    def delete(self, request):
        serializer = BookmarkWriteSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        rows = Bookmark.objects.filter(user=request.user, kind=data["kind"])
        if data["kind"] == BookmarkKind.TOPIC:
            # Mavzu endi ko'rinmasa ham o'z xatcho'pini olib tashlash mumkin.
            rows = rows.annotate(key=key_expr("topic__")).filter(key=data["topic_id"])
        else:
            rows = rows.filter(book__slug=data["book_id"])
        rows.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class RecentListView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        operation_id="me_recent_list",
        tags=TAGS,
        responses=RecentViewSerializer(many=True),
    )
    def get(self, request):
        rows = RecentView.objects.filter(user=request.user).select_related("topic__book")
        return Response(RecentViewSerializer(rows, many=True).data)


def _goal_qs(user):
    return StudyGoal.objects.filter(user=user).select_related("topic__book")


def _apply_goal(goal: StudyGoal, data: dict, request) -> None:
    if "title" in data:
        goal.title = data["title"]
    if "due_date" in data:
        goal.due_date = data["due_date"]
    if "topic_id" in data:
        key = data["topic_id"]
        goal.topic = resolve_topic(request, key) if key else None
    if "done" in data:
        if data["done"] and goal.done_at is None:
            goal.done_at = timezone.now()
        elif not data["done"]:
            goal.done_at = None


class GoalListView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        operation_id="me_goals_list", tags=TAGS, responses=StudyGoalSerializer(many=True)
    )
    def get(self, request):
        return Response(StudyGoalSerializer(_goal_qs(request.user), many=True).data)

    @extend_schema(
        operation_id="me_goals_create",
        tags=TAGS,
        request=StudyGoalWriteSerializer,
        responses={201: StudyGoalSerializer},
    )
    def post(self, request):
        serializer = StudyGoalWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            if StudyGoal.objects.filter(user=request.user).count() >= GOAL_LIMIT:
                raise serializers.ValidationError({"title": ["goal_limit"]})
            goal = StudyGoal(user=request.user)
            _apply_goal(goal, serializer.validated_data, request)
            goal.save()
        goal = _goal_qs(request.user).get(pk=goal.pk)
        return Response(StudyGoalSerializer(goal).data, status=status.HTTP_201_CREATED)


class GoalDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get(self, request, goal_id) -> StudyGoal:
        goal = _goal_qs(request.user).filter(pk=goal_id).first()
        if goal is None:
            raise NotFound("Goal not found.")
        return goal

    @extend_schema(operation_id="me_goals_retrieve", tags=TAGS, responses=StudyGoalSerializer)
    def get(self, request, goal_id):
        return Response(StudyGoalSerializer(self._get(request, goal_id)).data)

    @extend_schema(
        operation_id="me_goals_update",
        tags=TAGS,
        request=StudyGoalPatchSerializer,
        responses=StudyGoalSerializer,
    )
    def patch(self, request, goal_id):
        goal = self._get(request, goal_id)
        serializer = StudyGoalPatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        _apply_goal(goal, serializer.validated_data, request)
        goal.save()
        return Response(StudyGoalSerializer(self._get(request, goal_id)).data)

    @extend_schema(operation_id="me_goals_delete", tags=TAGS, responses={204: None})
    def delete(self, request, goal_id):
        self._get(request, goal_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class DashboardView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        operation_id="me_dashboard",
        tags=TAGS,
        summary="Kabinet bosh sahifasi: davom ettirish, fanlar, takrorlash, haftalik natija",
        responses=DashboardSerializer,
    )
    def get(self, request):
        return Response(DashboardSerializer(dashboard.student_dashboard(request)).data)


class ResultsView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        operation_id="me_results",
        tags=TAGS,
        summary="Natijalar mavzu kesimida: o'zlashtirilgan, takrorlash kerak, jarayonda",
        responses=ResultsSerializer,
    )
    def get(self, request):
        return Response(ResultsSerializer(dashboard.results(request.user)).data)


class TeacherDashboardView(APIView):
    permission_classes = [IsRole("teacher", "editor", "admin")]

    @extend_schema(
        operation_id="me_teacher_dashboard",
        tags=TAGS,
        responses=TeacherDashboardSerializer,
    )
    def get(self, request):
        return Response(TeacherDashboardSerializer(dashboard.teacher_dashboard(request.user)).data)


class MergeGuestDataView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        operation_id="me_merge_guest_data",
        tags=TAGS,
        summary="Mehmon ma'lumotini akkauntga qo'shish (idempotent, har ro'yxat 500 tagacha)",
        request=MergeRequestSerializer,
        responses=MergeResultSerializer,
    )
    def post(self, request):
        serializer = MergeRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        result = merge_guest_data(request, data.get("progress", []), data.get("bookmarks", []))
        return Response(MergeResultSerializer(result).data)
