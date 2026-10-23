import contextlib

from django.core.exceptions import ValidationError as DjangoValidationError
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsLearner, IsRole

from .models import PdfAnnotation, PdfReadProgress
from .serializers import (
    AnnotationSerializer,
    AnnotationWriteSerializer,
    DashboardSerializer,
    EventSerializer,
    GoalSerializer,
    GoalWriteSerializer,
    MergeRequestSerializer,
    MergeResultSerializer,
    PdfBookmarkSerializer,
    PdfLibraryItemSerializer,
    PdfLibrarySerializer,
    PdfProgressSerializer,
    PdfProgressWriteSerializer,
    ResultsSerializer,
    TeacherDashboardSerializer,
)
from .services import dashboard as dashboard_service
from .services.annotations import save_annotation
from .services.events import record_event
from .services.goals import create_goal, user_goals
from .services.merge import merge_guest_data
from .services.pdf import (
    add_pdf_bookmark,
    apply_pdf_progress,
    clamp_page,
    remove_pdf_bookmark,
    resolve_pdf_book,
    visible_bookmarks,
)
from .services.pdf import library as pdf_library

TAGS = ["learning"]


def _pdf_progress_qs(user):
    return PdfReadProgress.objects.filter(user=user).select_related("pdf_book")


class PdfProgressListView(APIView):
    permission_classes = [IsLearner]

    @extend_schema(
        operation_id="me_pdf_progress_list",
        tags=TAGS,
        summary="PDF darsliklar bo'yicha oxirgi sahifalar (eng yangisi birinchi)",
        responses=PdfProgressSerializer(many=True),
    )
    def get(self, request):
        rows = _pdf_progress_qs(request.user).order_by("-updated_at")[:200]
        return Response(PdfProgressSerializer(rows, many=True).data)


class PdfProgressDetailView(APIView):
    permission_classes = [IsLearner]

    @extend_schema(
        operation_id="me_pdf_progress_retrieve",
        tags=TAGS,
        responses=PdfProgressSerializer,
    )
    def get(self, request, pdf_book_id):
        book = resolve_pdf_book(request, pdf_book_id)
        row = _pdf_progress_qs(request.user).filter(pdf_book=book).first()
        if row is None:
            raise NotFound()
        return Response(PdfProgressSerializer(row).data)

    @extend_schema(
        operation_id="me_pdf_progress_update",
        tags=TAGS,
        summary="Oxirgi sahifani yozish (idempotent; qat'iy yangiroq mijoz vaqti yutadi)",
        request=PdfProgressWriteSerializer,
        responses=PdfProgressSerializer,
    )
    def put(self, request, pdf_book_id):
        serializer = PdfProgressWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        book = resolve_pdf_book(request, pdf_book_id)
        data = serializer.validated_data
        page = clamp_page(book, data["last_page"], strict=True)
        row, _changed = apply_pdf_progress(request.user, book, page, data.get("updated_at"))
        row.pdf_book = book
        return Response(PdfProgressSerializer(row).data)


class PdfBookmarkListView(APIView):
    permission_classes = [IsLearner]

    @extend_schema(
        operation_id="me_pdf_bookmarks_list",
        tags=TAGS,
        summary="Saqlangan PDF darsliklar (eng yangisi birinchi)",
        responses=PdfBookmarkSerializer(many=True),
    )
    def get(self, request):
        rows = visible_bookmarks(request, request.user)[:200]
        return Response(PdfBookmarkSerializer(rows, many=True).data)


class PdfBookmarkDetailView(APIView):
    permission_classes = [IsLearner]

    @extend_schema(
        operation_id="me_pdf_bookmarks_update",
        tags=TAGS,
        summary="Kitobni saqlash (idempotent)",
        request=None,
        responses=PdfBookmarkSerializer,
    )
    def put(self, request, pdf_book_id):
        book = resolve_pdf_book(request, pdf_book_id)
        bookmark, _created = add_pdf_bookmark(request.user, book)
        bookmark.pdf_book = book
        return Response(PdfBookmarkSerializer(bookmark).data)

    @extend_schema(
        operation_id="me_pdf_bookmarks_delete",
        tags=TAGS,
        summary="Saqlanganlardan olib tashlash (idempotent)",
        responses={204: None},
    )
    def delete(self, request, pdf_book_id):
        remove_pdf_bookmark(request.user, pdf_book_id)
        return Response(status=status.HTTP_204_NO_CONTENT)


class LibraryView(APIView):
    permission_classes = [IsLearner]

    @extend_schema(
        operation_id="me_library",
        tags=TAGS,
        summary="Kabinet: oxirgi ochilgan PDF darsliklar va saqlanganlar soni",
        responses=PdfLibrarySerializer,
    )
    def get(self, request):
        return Response(PdfLibrarySerializer(pdf_library(request, request.user)).data)


class AnnotationListView(APIView):
    permission_classes = [IsLearner]

    @extend_schema(
        operation_id="me_pdf_annotations_list",
        tags=TAGS,
        parameters=[OpenApiParameter("pdf_book", str, description="Kitob id'si (majburiy)")],
        summary="Kitobdagi mening belgilarim va eslatmalarim",
        responses=AnnotationSerializer(many=True),
    )
    def get(self, request):
        book = resolve_pdf_book(request, request.query_params.get("pdf_book", ""))
        rows = PdfAnnotation.objects.filter(user=request.user, pdf_book=book)
        return Response(AnnotationSerializer(rows, many=True).data)


class AnnotationDetailView(APIView):
    permission_classes = [IsLearner]

    @extend_schema(
        operation_id="me_pdf_annotations_update",
        tags=TAGS,
        summary="Belgini yozish (idempotent; id mijozda yaratilgan UUID)",
        request=AnnotationWriteSerializer,
        responses=AnnotationSerializer,
    )
    def put(self, request, annotation_id):
        serializer = AnnotationWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        book = resolve_pdf_book(request, data["pdf_book_id"])
        row, _created = save_annotation(
            request.user,
            book,
            annotation_id,
            page=data["page"],
            color=data["color"],
            rects=data["rects"],
            note=data["note"],
        )
        return Response(AnnotationSerializer(row).data)

    @extend_schema(
        operation_id="me_pdf_annotations_delete",
        tags=TAGS,
        summary="Belgini o'chirish (idempotent)",
        responses={204: None},
    )
    def delete(self, request, annotation_id):
        PdfAnnotation.objects.filter(user=request.user, pk=annotation_id).delete()
        return Response(status=204)


class MergeGuestDataView(APIView):
    permission_classes = [IsLearner]

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
        result = merge_guest_data(
            request,
            data.get("pdf_progress", []),
            data.get("pdf_bookmarks", []),
            data.get("pdf_annotations", []),
        )
        return Response(MergeResultSerializer(result).data)


class EventView(APIView):
    permission_classes = [IsLearner]

    @extend_schema(
        operation_id="me_events_create",
        tags=TAGS,
        summary="O'qish hodisasi: kitob ochildi / o'qib bo'lindi (idempotent)",
        request=EventSerializer,
        responses=PdfProgressSerializer,
    )
    def post(self, request):
        serializer = EventSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        book = resolve_pdf_book(request, data["pdf_book_id"])
        row = record_event(request.user, book, data["kind"])
        row.pdf_book = book
        return Response(PdfProgressSerializer(row).data)


class RecentView(APIView):
    permission_classes = [IsLearner]

    @extend_schema(
        operation_id="me_recent",
        tags=TAGS,
        summary="Oxirgi ochilgan 20 ta kitob (eng yangisi birinchi)",
        responses=PdfLibraryItemSerializer(many=True),
    )
    def get(self, request):
        rows = dashboard_service.recent(request, request.user)
        return Response(PdfLibraryItemSerializer(rows, many=True).data)


class DashboardView(APIView):
    permission_classes = [IsLearner]

    @extend_schema(
        operation_id="me_dashboard",
        tags=TAGS,
        summary="Bosh sahifa: davom ettirish, fanlarim, takrorlash, haftalik natija",
        responses=DashboardSerializer,
    )
    def get(self, request):
        data = dashboard_service.dashboard(request, request.user)
        return Response(DashboardSerializer(data).data)


class ResultsView(APIView):
    permission_classes = [IsLearner]

    @extend_schema(
        operation_id="me_results",
        tags=TAGS,
        summary="Natijalar: o'qilgan, jarayondagi va takrorlash kerak kitoblar",
        responses=ResultsSerializer,
    )
    def get(self, request):
        return Response(ResultsSerializer(dashboard_service.results(request, request.user)).data)


class TeacherDashboardView(APIView):
    permission_classes = [IsRole("teacher")]

    @extend_schema(
        operation_id="me_teacher_dashboard",
        tags=TAGS,
        summary="Ustoz bosh sahifasi: umumiy ko'rsatkichlar + sinflar bo'yicha qamrov",
        responses=TeacherDashboardSerializer,
    )
    def get(self, request):
        data = dashboard_service.teacher_dashboard(request, request.user)
        return Response(TeacherDashboardSerializer(data).data)


class GoalListView(APIView):
    permission_classes = [IsLearner]

    @extend_schema(
        operation_id="me_goals_list",
        tags=TAGS,
        summary="Rejalarim (bajarilmaganlar birinchi, muddat bo'yicha)",
        responses=GoalSerializer(many=True),
    )
    def get(self, request):
        return Response(GoalSerializer(user_goals(request.user), many=True).data)

    @extend_schema(
        operation_id="me_goals_create",
        tags=TAGS,
        request=GoalWriteSerializer,
        responses={201: GoalSerializer},
    )
    def post(self, request):
        serializer = GoalWriteSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        goal = create_goal(
            request.user,
            title=data["title"],
            pdf_book=data.get("pdf_book_id"),
            due_date=data.get("due_date"),
        )
        if data.get("done"):
            serializer.apply(goal)
        return Response(GoalSerializer(goal).data, status=status.HTTP_201_CREATED)


class GoalDetailView(APIView):
    permission_classes = [IsLearner]

    def _goal(self, request, goal_id):
        # Faqat o'zining rejasi: begonaniki 404 (mavjudligi oshkor bo'lmaydi).
        try:
            goal = user_goals(request.user).filter(pk=goal_id).first()
        except DjangoValidationError:
            goal = None
        if goal is None:
            raise NotFound()
        return goal

    @extend_schema(operation_id="me_goals_retrieve", tags=TAGS, responses=GoalSerializer)
    def get(self, request, goal_id):
        return Response(GoalSerializer(self._goal(request, goal_id)).data)

    @extend_schema(
        operation_id="me_goals_partial_update",
        tags=TAGS,
        request=GoalWriteSerializer,
        responses=GoalSerializer,
    )
    def patch(self, request, goal_id):
        goal = self._goal(request, goal_id)
        serializer = GoalWriteSerializer(
            data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        return Response(GoalSerializer(serializer.apply(goal)).data)

    @extend_schema(
        operation_id="me_goals_delete",
        tags=TAGS,
        summary="Rejani o'chirish (idempotent)",
        responses={204: None},
    )
    def delete(self, request, goal_id):
        with contextlib.suppress(DjangoValidationError):
            user_goals(request.user).filter(pk=goal_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
