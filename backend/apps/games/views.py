from django.conf import settings
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.exceptions import NotFound
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.content.views import GRADE_PARAM, SUBJECT_PARAM, _int_param
from apps.core.permissions import IsLearner

from . import services
from .models import GameSession
from .serializers import (
    AllowanceSerializer,
    CheckAnswerRequestSerializer,
    CheckAnswerSerializer,
    GameQuestionsSerializer,
    GameSessionSerializer,
    GameTopicSerializer,
    SessionFinishRequestSerializer,
    SessionStartRequestSerializer,
    SessionStartSerializer,
)

TAGS = ["games"]
NO_STORE = "private, no-store"


class GameTopicListView(ListAPIView):
    """O'yin uchun mavzular: kamida `GAMES_MIN_QUESTIONS` faol savol, nashr qilingan kitobda."""

    permission_classes = [AllowAny]
    serializer_class = GameTopicSerializer
    filter_backends: list = []

    @extend_schema(
        operation_id="games_topics_list",
        tags=TAGS,
        parameters=[
            OpenApiParameter(
                "q", OpenApiTypes.STR, description="Mavzu, fan yoki darslik nomi (barcha tillarda)"
            ),
            GRADE_PARAM,
            SUBJECT_PARAM,
        ],
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        params = self.request.query_params
        return services.search_topics(
            query=params.get("q", "")[:100],
            grade=_int_param(self.request, "grade"),
            subject=params.get("subject", ""),
        )


class GameQuestionsView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        operation_id="games_topic_questions",
        tags=TAGS,
        parameters=[
            OpenApiParameter(
                "count", OpenApiTypes.INT, description="Savollar soni (4–40, standart 16)"
            )
        ],
        responses=GameQuestionsSerializer,
        summary="Tasodifiy savollar (variantlar aralashgan); `is_correct` o'rniga `answer_token`",
    )
    def get(self, request, slug):
        topic = services.get_playable_topic(slug)
        count = _int_param(request, "count") or settings.GAMES_DEFAULT_QUESTIONS
        count = min(max(count, settings.GAMES_MIN_COUNT), settings.GAMES_MAX_COUNT)
        data = {"topic": topic, "questions": services.random_questions(topic, count)}
        response = Response(GameQuestionsSerializer(data, context={"request": request}).data)
        response["Cache-Control"] = NO_STORE
        return response


class CheckAnswerView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        operation_id="games_check_answer",
        tags=TAGS,
        request=CheckAnswerRequestSerializer,
        responses=CheckAnswerSerializer,
    )
    def post(self, request):
        body = CheckAnswerRequestSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        result = services.check_answer(
            body.validated_data["answer_token"], body.validated_data["option_id"]
        )
        return Response(CheckAnswerSerializer(result).data)


class AllowanceView(APIView):
    permission_classes = [IsLearner]

    @extend_schema(
        operation_id="games_allowance",
        tags=TAGS,
        responses=AllowanceSerializer,
        summary="Oylik bepul o'yinlar va tanga balansi (yangi oyda bonus beriladi)",
    )
    def get(self, request):
        response = Response(AllowanceSerializer(services.allowance_summary(request.user)).data)
        response["Cache-Control"] = NO_STORE
        return response


class SessionStartView(APIView):
    permission_classes = [IsLearner]

    @extend_schema(
        operation_id="games_sessions_start",
        tags=TAGS,
        request=SessionStartRequestSerializer,
        responses={201: SessionStartSerializer},
        summary="O'yin boshlanishi: bitta urinish sarflanadi (bepul, tugagan bo'lsa tanga)",
    )
    def post(self, request):
        body = SessionStartRequestSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        session, allowance = services.start_session(
            request.user, body.validated_data["game_type"], body.validated_data.get("topic")
        )
        data = {"session_id": session.pk, "paid_with": session.paid_with, "allowance": allowance}
        return Response(SessionStartSerializer(data).data, status=201)


class SessionFinishView(APIView):
    permission_classes = [IsLearner]

    @extend_schema(
        operation_id="games_sessions_finish",
        tags=TAGS,
        request=SessionFinishRequestSerializer,
        responses=GameSessionSerializer,
        summary="Natijani saqlash (bir marta; qayta — 409 `session_finished`)",
    )
    def post(self, request, pk):
        session = GameSession.objects.filter(pk=pk, user=request.user).first()
        if session is None:
            raise NotFound("Session not found.")
        body = SessionFinishRequestSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        session = services.finish_session(session, body.validated_data)
        return Response(GameSessionSerializer(session).data)
