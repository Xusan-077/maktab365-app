from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .serializers import (
    ExportSerializer,
    MeSerializer,
    OnboardingSerializer,
    ProfileUpdateSerializer,
    RoleSerializer,
)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(operation_id="me_retrieve", responses=MeSerializer, tags=["me"])
    def get(self, request):
        return Response(MeSerializer(request.user).data)

    @extend_schema(
        operation_id="me_update",
        request=ProfileUpdateSerializer,
        responses=MeSerializer,
        tags=["me"],
    )
    def patch(self, request):
        serializer = ProfileUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.update_profile(request.user, serializer.validated_data, request)
        return Response(MeSerializer(request.user).data)

    @extend_schema(
        operation_id="me_delete",
        summary="Akkauntni o'chirish (soft delete + anonimlashtirish)",
        responses={204: None},
        tags=["me"],
    )
    def delete(self, request):
        services.delete_account(request.user, request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class OnboardingView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        operation_id="me_onboarding",
        request=OnboardingSerializer,
        responses=MeSerializer,
        tags=["me"],
    )
    def post(self, request):
        serializer = OnboardingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        role = data.pop("role")
        services.complete_onboarding(request.user, role=role, data=data, request=request)
        return Response(MeSerializer(request.user).data)


class RoleView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        operation_id="me_role_update",
        request=RoleSerializer,
        responses=MeSerializer,
        tags=["me"],
    )
    def patch(self, request):
        serializer = RoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.change_role(request.user, serializer.validated_data["role"], request=request)
        return Response(MeSerializer(request.user).data)


class ExportView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(operation_id="me_export", responses=ExportSerializer, tags=["me"])
    def get(self, request):
        data = ExportSerializer(services.export_data(request.user, request)).data
        response = Response(data)
        response["Content-Disposition"] = 'attachment; filename="darslik365-data.json"'
        return response
