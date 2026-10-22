from django.db import transaction
from django.db.models import Count, ProtectedError, Q
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import generics, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts import audit
from apps.accounts.models import AuditLog, Role, User
from apps.core.permissions import IsRole
from apps.support.models import Status as SupportStatus
from apps.support.models import SupportMessage

from . import admin_services as services
from .admin_serializers import (
    BookAdminSerializer,
    ChapterAdminSerializer,
    ReorderSerializer,
    SubjectAdminSerializer,
    TopicAdminSerializer,
    TopicListSerializer,
    TransitionSerializer,
    UploadRequestSerializer,
    UploadResultSerializer,
)
from .models import Book, Chapter, PdfBook, PdfBookStatus, Subject, Topic, TopicStatus


class ReorderResultSerializer(serializers.Serializer):
    pass


IsEditor = IsRole(Role.EDITOR, Role.ADMIN)
IsAdmin = IsRole(Role.ADMIN)

TAG = ["admin"]


def _published(prefix: str = "") -> Q:
    return Q(**{f"{prefix}status": TopicStatus.PUBLISHED})


class AdminViewSet(viewsets.ModelViewSet):
    """Audit bilan CRUD: editor/admin yaratadi va tahrirlaydi, o'chirish — faqat admin."""

    target_type: str
    snapshot_fields: tuple[str, ...]
    ordering = ["-updated_at"]

    def get_permissions(self):
        permission = IsAdmin if self.action == "destroy" else IsEditor
        return [permission()]

    def label(self, instance) -> str:
        return getattr(instance, "slug", str(instance.pk))

    def snap(self, instance) -> dict:
        return audit.snapshot(instance, self.snapshot_fields)

    def log(self, action_name, instance, before=None, after=None):
        audit.record(
            self.request.user,
            action_name,
            self.target_type,
            instance.pk,
            label=self.label(instance),
            before=before,
            after=after,
            request=self.request,
        )

    @transaction.atomic
    def perform_create(self, serializer):
        instance = serializer.save()
        self.log("create", instance, after=self.snap(instance))

    @transaction.atomic
    def perform_update(self, serializer):
        before = self.snap(serializer.instance)
        instance = serializer.save()
        self.log("update", instance, before=before, after=self.snap(instance))

    def perform_destroy(self, instance):
        before, label = self.snap(instance), self.label(instance)
        try:
            with transaction.atomic():
                pk = instance.pk
                instance.delete()
                audit.record(
                    self.request.user,
                    "delete",
                    self.target_type,
                    pk,
                    label=label,
                    before=before,
                    request=self.request,
                )
        except ProtectedError:
            raise services.HasDependents() from None


@extend_schema_view(
    list=extend_schema(operation_id="admin_subjects_list", tags=TAG),
    create=extend_schema(operation_id="admin_subjects_create", tags=TAG),
    retrieve=extend_schema(operation_id="admin_subjects_retrieve", tags=TAG),
    partial_update=extend_schema(operation_id="admin_subjects_update", tags=TAG),
    destroy=extend_schema(operation_id="admin_subjects_delete", tags=TAG),
)
class SubjectAdminViewSet(AdminViewSet):
    target_type = "subject"
    snapshot_fields = ("slug", "title", "icon", "order")
    serializer_class = SubjectAdminSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    search_fields = ["slug", "title__uz", "title__ru", "title__en"]
    ordering_fields = ["order", "slug", "updated_at", "created_at"]
    ordering = ["order", "slug"]

    def get_queryset(self):
        return Subject.objects.annotate(
            books_count=Count("books", distinct=True),
            pdf_books_count=Count("pdf_books", distinct=True),
        )


@extend_schema_view(
    list=extend_schema(
        operation_id="admin_books_list",
        tags=TAG,
        parameters=[
            OpenApiParameter("grade", int),
            OpenApiParameter("subject", str, description="Fan slug'i"),
            OpenApiParameter("status", str, enum=["published", "draft"]),
        ],
    ),
    create=extend_schema(operation_id="admin_books_create", tags=TAG),
    retrieve=extend_schema(operation_id="admin_books_retrieve", tags=TAG),
    partial_update=extend_schema(operation_id="admin_books_update", tags=TAG),
    destroy=extend_schema(operation_id="admin_books_delete", tags=TAG),
)
class BookAdminViewSet(AdminViewSet):
    target_type = "book"
    snapshot_fields = (
        "slug",
        "subject_id",
        "grade",
        "title",
        "author",
        "publisher",
        "edition",
        "year",
        "cover",
        "pdf",
        "order",
        "is_published",
    )
    serializer_class = BookAdminSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    search_fields = ["slug", "title__uz", "title__ru", "title__en", "author__uz"]
    ordering_fields = ["grade", "slug", "order", "updated_at", "created_at", "year"]
    ordering = ["grade", "order", "slug"]

    def snap(self, instance):
        data = super().snap(instance)
        data["cover"], data["pdf"] = str(instance.cover or ""), str(instance.pdf or "")
        return data

    def get_queryset(self):
        qs = Book.objects.select_related("subject").annotate(
            chapters_count=Count("chapters", distinct=True),
            topics_count=Count("topics", distinct=True),
            published_topics_count=Count("topics", filter=_published("topics__"), distinct=True),
        )
        params = self.request.query_params
        if params.get("grade", "").isdigit():
            qs = qs.filter(grade=int(params["grade"]))
        if params.get("subject"):
            qs = qs.filter(subject__slug=params["subject"])
        if params.get("status") in ("published", "draft"):
            qs = qs.filter(is_published=params["status"] == "published")
        return qs

    @extend_schema(
        operation_id="admin_books_reorder",
        tags=TAG,
        request=ReorderSerializer,
        responses={200: ReorderResultSerializer},
    )
    @action(detail=True, methods=["post"])
    def reorder(self, request, pk=None):
        """Bob va mavzular tartibi bir so'rovda (qoidalar: `admin_services.reorder_book`)."""
        book = self.get_object()
        body = ReorderSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        data = body.validated_data
        with transaction.atomic():
            services.reorder_book(book, data.get("chapters"), data.get("topics"))
            audit.record(
                request.user,
                "reorder",
                "book",
                book.pk,
                label=book.slug,
                after={
                    "chapters": len(data.get("chapters") or []),
                    "topics": len(data.get("topics") or {}),
                },
                request=request,
            )
        return Response({})


@extend_schema_view(
    list=extend_schema(
        operation_id="admin_chapters_list",
        tags=TAG,
        parameters=[OpenApiParameter("book", str, description="Kitob id'si")],
    ),
    create=extend_schema(operation_id="admin_chapters_create", tags=TAG),
    retrieve=extend_schema(operation_id="admin_chapters_retrieve", tags=TAG),
    partial_update=extend_schema(operation_id="admin_chapters_update", tags=TAG),
    destroy=extend_schema(operation_id="admin_chapters_delete", tags=TAG),
)
class ChapterAdminViewSet(AdminViewSet):
    target_type = "chapter"
    snapshot_fields = ("slug", "book_id", "title", "order")
    serializer_class = ChapterAdminSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    search_fields = ["slug", "title__uz", "title__ru", "title__en"]
    ordering_fields = ["order", "slug", "updated_at"]
    ordering = ["book", "order"]

    def get_queryset(self):
        qs = Chapter.objects.select_related("book").annotate(topics_count=Count("topics"))
        if self.request.query_params.get("book"):
            qs = qs.filter(book_id=self.request.query_params["book"])
        return qs


@extend_schema_view(
    list=extend_schema(
        operation_id="admin_topics_list",
        tags=TAG,
        parameters=[
            OpenApiParameter("book", str, description="Kitob id'si"),
            OpenApiParameter("chapter", str, description="Bob id'si"),
            OpenApiParameter("status", str, enum=[s.value for s in TopicStatus]),
        ],
    ),
    create=extend_schema(operation_id="admin_topics_create", tags=TAG),
    retrieve=extend_schema(operation_id="admin_topics_retrieve", tags=TAG),
    partial_update=extend_schema(operation_id="admin_topics_update", tags=TAG),
    destroy=extend_schema(operation_id="admin_topics_delete", tags=TAG),
)
class TopicAdminViewSet(AdminViewSet):
    target_type = "topic"
    snapshot_fields = ("slug", "chapter_id", "title", "summary", "status", "order", "notes")
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    search_fields = ["slug", "title__uz", "title__ru", "title__en"]
    ordering_fields = ["order", "slug", "status", "updated_at", "published_at"]
    ordering = ["chapter__order", "order"]

    def get_serializer_class(self):
        return TopicListSerializer if self.action == "list" else TopicAdminSerializer

    def snap(self, instance):
        data = super().snap(instance)
        data["blocks_count"] = len(instance.blocks or [])
        return data

    def get_queryset(self):
        qs = Topic.objects.select_related("chapter", "book", "reviewed_by")
        params = self.request.query_params
        if params.get("book"):
            qs = qs.filter(book_id=params["book"])
        if params.get("chapter"):
            qs = qs.filter(chapter_id=params["chapter"])
        if params.get("status") in TopicStatus.values:
            qs = qs.filter(status=params["status"])
        return qs

    @extend_schema(
        operation_id="admin_topics_transition",
        tags=TAG,
        request=TransitionSerializer,
        responses={200: TopicAdminSerializer},
    )
    @action(detail=True, methods=["post"])
    def transition(self, request, pk=None):
        """Nashr oqimi: draft→reviewed→published (editor/admin), published→draft (admin)."""
        topic = self.get_object()
        body = TransitionSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        before = self.snap(topic)
        with transaction.atomic():
            topic = services.transition_topic(topic, body.validated_data["to"], request.user)
            self.log("transition", topic, before=before, after=self.snap(topic))
        return Response(TopicAdminSerializer(topic, context=self.get_serializer_context()).data)


class UploadView(APIView):
    permission_classes = [IsEditor]
    parser_classes = [MultiPartParser]

    @extend_schema(
        operation_id="admin_uploads_create",
        tags=TAG,
        request={"multipart/form-data": UploadRequestSerializer},
        responses={201: UploadResultSerializer},
    )
    def post(self, request):
        body = UploadRequestSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        result = services.store_upload(body.validated_data["file"], body.validated_data["kind"])
        audit.record(
            request.user,
            "upload",
            "file",
            result["path"],
            label=result["name"],
            after={"size": result["size"], "content_type": result["content_type"]},
            request=request,
        )
        return Response(result, status=201)


class BookCountsSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    draft = serializers.IntegerField()
    published = serializers.IntegerField()


class TopicCountsSerializer(BookCountsSerializer):
    reviewed = serializers.IntegerField()


class RecentMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupportMessage
        fields = ["id", "kind", "message", "created_at"]


class AuditEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = [
            "id",
            "actor_label",
            "action",
            "target_type",
            "target_id",
            "target_label",
            "before",
            "after",
            "created_at",
        ]


class AdminDashboardSerializer(serializers.Serializer):
    books = BookCountsSerializer()
    pdf_books = BookCountsSerializer()
    subjects_count = serializers.IntegerField()
    topics = TopicCountsSerializer()
    new_messages = serializers.IntegerField()
    recent_messages = RecentMessageSerializer(many=True)
    recent_activity = AuditEntrySerializer(many=True)


class DashboardView(APIView):
    permission_classes = [IsEditor]

    @extend_schema(operation_id="admin_dashboard", tags=TAG, responses=AdminDashboardSerializer)
    def get(self, request):
        books = Book.objects.aggregate(
            total=Count("pk"),
            published=Count("pk", filter=Q(is_published=True)),
            draft=Count("pk", filter=Q(is_published=False)),
        )
        pdf_books = PdfBook.objects.aggregate(
            total=Count("pk"),
            published=Count("pk", filter=Q(status=PdfBookStatus.PUBLISHED)),
            draft=Count("pk", filter=Q(status=PdfBookStatus.DRAFT)),
        )
        topics = Topic.objects.aggregate(
            total=Count("pk"),
            **{s.value: Count("pk", filter=Q(status=s)) for s in TopicStatus},
        )
        new = SupportMessage.objects.filter(status=SupportStatus.NEW)
        data = {
            "books": books,
            "pdf_books": pdf_books,
            "subjects_count": Subject.objects.count(),
            "topics": topics,
            "new_messages": new.count(),
            "recent_messages": new.order_by("-created_at")[:5],
            "recent_activity": AuditLog.objects.order_by("-created_at")[:10],
        }
        return Response(AdminDashboardSerializer(data).data)


class UserAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "role", "is_active", "date_joined"]
        read_only_fields = fields


class UserAdminListView(generics.ListAPIView):
    """Foydalanuvchilar ro'yxati — faqat admin (faqat o'qish)."""

    permission_classes = [IsAdmin]
    serializer_class = UserAdminSerializer
    search_fields = ["email"]
    ordering_fields = ["date_joined", "email", "role"]
    ordering = ["-date_joined"]

    def get_queryset(self):
        qs = User.objects.all()
        if self.request.query_params.get("role") in Role.values:
            qs = qs.filter(role=self.request.query_params["role"])
        return qs

    @extend_schema(
        operation_id="admin_users_list",
        tags=TAG,
        parameters=[OpenApiParameter("role", str, enum=list(Role.values))],
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)
