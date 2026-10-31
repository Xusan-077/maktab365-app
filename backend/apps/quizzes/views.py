from django.db.models import Count, F, FloatField, Max, Q
from django.db.models.functions import Cast, Floor
from django.shortcuts import get_object_or_404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.generics import (
    GenericAPIView,
    ListCreateAPIView,
    RetrieveUpdateDestroyAPIView,
)
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.content import admin_services
from apps.core.permissions import IsRole

from . import services
from .models import Quiz
from .serializers import (
    AttemptCreateSerializer,
    AttemptSerializer,
    CategoryCreateSerializer,
    CategorySerializer,
    CheckRequestSerializer,
    CheckResultSerializer,
    PublicQuizSerializer,
    QuizListSerializer,
    QuizSerializer,
    QuizUploadRequestSerializer,
    QuizUploadResultSerializer,
)

TAGS = ["quizzes"]
IsTeacher = IsRole("teacher")


def own_quizzes(request):
    """Ustoz faqat o'z testlarini ko'radi: begonaniki 404."""
    return Quiz.objects.filter(teacher=request.user)


class QuizListCreateView(ListCreateAPIView):
    permission_classes = [IsTeacher]
    pagination_class = None
    filter_backends: list = []

    def get_serializer_class(self):
        return QuizSerializer if self.request.method == "POST" else QuizListSerializer

    def get_queryset(self):
        params = self.request.query_params
        quizzes = (
            own_quizzes(self.request)
            .select_related("category")
            .annotate(
                question_count=Count("questions", distinct=True),
                attempts_count=Count("attempts", distinct=True),
                best_percent=Floor(
                    Max(
                        Cast(F("attempts__score"), FloatField())
                        * 100.0
                        / Cast(F("attempts__total"), FloatField())
                    )
                ),
            )
        )
        # Agregatli so'rovda Django `Meta.ordering` ni qo'llamaydi: tartib aniq berilishi shart.
        quizzes = quizzes.order_by("-updated_at", "-created_at")
        if category := params.get("category"):
            quizzes = quizzes.filter(category_id=category)
        if q := params.get("q", "").strip()[:100]:
            quizzes = quizzes.filter(Q(title__icontains=q) | Q(description__icontains=q))
        return quizzes

    @extend_schema(
        operation_id="quizzes_list",
        tags=TAGS,
        parameters=[
            OpenApiParameter("category", OpenApiTypes.UUID, description="Kategoriya id"),
            OpenApiParameter("q", OpenApiTypes.STR, description="Sarlavha yoki tavsif bo'yicha"),
        ],
        responses=QuizListSerializer(many=True),
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(
        operation_id="quizzes_create",
        tags=TAGS,
        request=QuizSerializer,
        responses={201: QuizSerializer},
    )
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)


@extend_schema(tags=TAGS)
class QuizDetailView(RetrieveUpdateDestroyAPIView):
    permission_classes = [IsTeacher]
    serializer_class = QuizSerializer
    http_method_names = ["get", "put", "delete", "head", "options"]

    def get_queryset(self):
        return (
            own_quizzes(self.request)
            .select_related("category")
            .prefetch_related("questions__options")
        )

    @extend_schema(operation_id="quizzes_retrieve")
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(operation_id="quizzes_update")
    def put(self, request, *args, **kwargs):
        return super().put(request, *args, **kwargs)

    @extend_schema(operation_id="quizzes_destroy")
    def delete(self, request, *args, **kwargs):
        return super().delete(request, *args, **kwargs)


class QuizDuplicateView(GenericAPIView):
    permission_classes = [IsTeacher]
    serializer_class = QuizSerializer

    def get_queryset(self):
        return own_quizzes(self.request)

    @extend_schema(
        operation_id="quizzes_duplicate",
        tags=TAGS,
        request=None,
        responses={201: QuizSerializer},
        summary="Testni nusxalash (nusxa shaxsiy bo'ladi, urinishlar ko'chmaydi)",
    )
    def post(self, request, pk):
        copy = services.duplicate_quiz(self.get_object())
        return Response(QuizSerializer(copy, context={"request": request}).data, status=201)


class CategoryListCreateView(APIView):
    permission_classes = [IsTeacher]

    @extend_schema(
        operation_id="quizzes_categories_list",
        tags=TAGS,
        responses=CategorySerializer(many=True),
    )
    def get(self, request):
        categories = services.categories_for(request.user)
        return Response(CategorySerializer(categories, many=True).data)

    @extend_schema(
        operation_id="quizzes_categories_create",
        tags=TAGS,
        request=CategoryCreateSerializer,
        responses={201: CategorySerializer},
    )
    def post(self, request):
        body = CategoryCreateSerializer(data=request.data, context={"request": request})
        body.is_valid(raise_exception=True)
        category = request.user.quiz_categories.create(name=body.validated_data["name"])
        return Response(CategorySerializer(category).data, status=201)


class UploadView(APIView):
    """Muqova/savol rasmi: ustoz yuklaydi, natijadagi `path` test yozilganda beriladi."""

    permission_classes = [IsTeacher]
    parser_classes = [MultiPartParser]

    @extend_schema(
        operation_id="quizzes_uploads_create",
        tags=TAGS,
        request={"multipart/form-data": QuizUploadRequestSerializer},
        responses={201: QuizUploadResultSerializer},
    )
    def post(self, request):
        body = QuizUploadRequestSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        result = admin_services.store_upload(body.validated_data["file"], "image")
        return Response({"path": result["path"], "url": result["url"]}, status=201)


class AttemptListCreateView(GenericAPIView):
    permission_classes = [IsTeacher]
    pagination_class = None
    serializer_class = AttemptSerializer

    def get_quiz(self):
        return get_object_or_404(own_quizzes(self.request), pk=self.kwargs["pk"])

    @extend_schema(
        operation_id="quizzes_attempts_list",
        tags=TAGS,
        responses=AttemptSerializer(many=True),
        summary="Test bo'yicha natijalar tarixi (yangilari avval)",
    )
    def get(self, request, pk):
        attempts = self.get_quiz().attempts.all()
        return Response(AttemptSerializer(attempts, many=True).data)

    @extend_schema(
        operation_id="quizzes_attempts_create",
        tags=TAGS,
        request=AttemptCreateSerializer,
        responses={201: AttemptSerializer},
        summary="Natijani saqlash: javoblar serverda tekshiriladi, ball hisoblanadi",
    )
    def post(self, request, pk):
        quiz = self.get_quiz()
        body = AttemptCreateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        attempt = services.create_attempt(
            quiz,
            request.user,
            body.validated_data["answers"],
            body.validated_data["time_spent"],
        )
        return Response(AttemptSerializer(attempt).data, status=201)


class PublicQuizView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        operation_id="quizzes_public_retrieve",
        tags=TAGS,
        responses=PublicQuizSerializer,
        summary="Ochiq test (havola orqali, login shart emas); shaxsiy test — 404",
    )
    def get(self, request, pk):
        quiz = services.get_public_quiz(pk)
        response = Response(PublicQuizSerializer(quiz, context={"request": request}).data)
        response["Cache-Control"] = "private, no-store"
        return response


class PublicCheckView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        operation_id="quizzes_public_check",
        tags=TAGS,
        request=CheckRequestSerializer,
        responses=CheckResultSerializer,
        summary="Ochiq testda bitta javobni tekshirish (natija saqlanmaydi)",
    )
    def post(self, request, pk):
        quiz = services.get_public_quiz(pk)
        body = CheckRequestSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        result = services.check_answer(
            quiz, body.validated_data["question_id"], body.validated_data["option_id"]
        )
        return Response(CheckResultSerializer(result).data)
