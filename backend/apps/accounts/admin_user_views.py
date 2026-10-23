from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.response import Response

from apps.core.permissions import IsRole

from . import admin_user_services as services
from .auth_serializers import password_field
from .models import Role, User

TAG = ["admin"]


class UserAdminSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "display_name", "role", "is_active", "is_env_admin", "date_joined"]
        read_only_fields = fields

    def get_display_name(self, user) -> str:
        profile = getattr(user, "profile", None)
        return profile.display_name if profile else ""


class UserAdminCreatedSerializer(UserAdminSerializer):
    temporary_password = serializers.CharField(
        read_only=True,
        allow_null=True,
        help_text="Parol berilmasa yaratilgan vaqtinchalik parol (faqat shu javobda, bir marta).",
    )

    class Meta(UserAdminSerializer.Meta):
        fields = [*UserAdminSerializer.Meta.fields, "temporary_password"]
        read_only_fields = fields


class UserAdminCreateSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    display_name = serializers.CharField(max_length=60, required=False, allow_blank=True)
    password = password_field(required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=Role.choices)


class UserAdminUpdateSerializer(serializers.Serializer):
    display_name = serializers.CharField(max_length=60, required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=Role.choices, required=False)
    is_active = serializers.BooleanField(required=False)


@extend_schema_view(
    list=extend_schema(
        operation_id="admin_users_list",
        tags=TAG,
        parameters=[
            OpenApiParameter("role", str, enum=list(Role.values)),
            OpenApiParameter("status", str, enum=["active", "blocked"]),
        ],
    ),
    create=extend_schema(
        operation_id="admin_users_create",
        tags=TAG,
        request=UserAdminCreateSerializer,
        responses={201: UserAdminCreatedSerializer},
    ),
    partial_update=extend_schema(
        operation_id="admin_users_update",
        tags=TAG,
        request=UserAdminUpdateSerializer,
        responses=UserAdminSerializer,
    ),
    destroy=extend_schema(operation_id="admin_users_delete", tags=TAG),
)
class UserAdminViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Foydalanuvchilar boshqaruvi — faqat admin."""

    permission_classes = [IsRole(Role.ADMIN)]
    serializer_class = UserAdminSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    search_fields = ["email", "profile__display_name"]
    ordering_fields = ["date_joined", "email", "role"]
    ordering = ["-date_joined"]

    def get_queryset(self):
        qs = User.objects.select_related("profile")
        params = self.request.query_params
        if params.get("role") in Role.values:
            qs = qs.filter(role=params["role"])
        if params.get("status") == "active":
            qs = qs.filter(is_active=True)
        elif params.get("status") == "blocked":
            qs = qs.filter(is_active=False)
        return qs

    def create(self, request, *args, **kwargs):
        body = UserAdminCreateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        user, generated = services.create_user(request.user, request=request, **body.validated_data)
        user.temporary_password = generated
        return Response(UserAdminCreatedSerializer(user).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        body = UserAdminUpdateSerializer(data=request.data, partial=True)
        body.is_valid(raise_exception=True)
        user = services.update_user(
            request.user, self.get_object(), request=request, **body.validated_data
        )
        return Response(UserAdminSerializer(user).data)

    def destroy(self, request, *args, **kwargs):
        services.delete_user(request.user, self.get_object(), request=request)
        return Response(status=status.HTTP_204_NO_CONTENT)
