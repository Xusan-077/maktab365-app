from django.db import transaction
from django.db.models import Count, ProtectedError, Q
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import generics, serializers, viewsets
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
    SubjectAdminSerializer,
    UploadRequestSerializer,
    UploadResultSerializer,
)
from .models import PdfBook, PdfBookStatus, Subject

IsEditor = IsRole(Role.EDITOR, Role.ADMIN)
IsAdmin = IsRole(Role.ADMIN)

TAG = ["admin"]


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
        return Subject.objects.annotate(pdf_books_count=Count("pdf_books"))


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
    pdf_books = BookCountsSerializer()
    subjects_count = serializers.IntegerField()
    new_messages = serializers.IntegerField()
    recent_messages = RecentMessageSerializer(many=True)
    recent_activity = AuditEntrySerializer(many=True)


class DashboardView(APIView):
    permission_classes = [IsEditor]

    @extend_schema(operation_id="admin_dashboard", tags=TAG, responses=AdminDashboardSerializer)
    def get(self, request):
        pdf_books = PdfBook.objects.aggregate(
            total=Count("pk"),
            published=Count("pk", filter=Q(status=PdfBookStatus.PUBLISHED)),
            draft=Count("pk", filter=Q(status=PdfBookStatus.DRAFT)),
        )
        new = SupportMessage.objects.filter(status=SupportStatus.NEW)
        data = {
            "pdf_books": pdf_books,
            "subjects_count": Subject.objects.count(),
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
