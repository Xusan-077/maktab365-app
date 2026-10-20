import structlog
from django.db import transaction
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.throttling import SupportRateThrottle

from .models import Status, SupportMessage
from .serializers import (
    SupportCreateSerializer,
    SupportMessageSerializer,
    SupportReceivedSerializer,
)
from .spam import is_spam
from .tasks import notify_staff

log = structlog.get_logger()


class SupportCreateView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [SupportRateThrottle]

    @extend_schema(
        operation_id="support_create",
        request=SupportCreateSerializer,
        responses={201: SupportReceivedSerializer},
    )
    def post(self, request):
        serializer = SupportCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        received = Response({"ok": True}, status=status.HTTP_201_CREATED)

        if data["website"]:
            # Bot: muvaffaqiyat ko'rsatamiz, lekin saqlamaymiz.
            log.info("support_honeypot")
            return received

        user = request.user if request.user.is_authenticated else None
        spam = is_spam(data["message"], data["name"])
        with transaction.atomic():
            msg = SupportMessage.objects.create(
                user=user,
                name=data["name"],
                email=data["email"] or (user.email if user and user.email else ""),
                kind=data["kind"],
                message=data["message"],
                page_url=data["page_url"],
                topic=data["topic"],
                user_agent=request.META.get("HTTP_USER_AGENT", "")[:300],
                status=Status.SPAM if spam else Status.NEW,
            )
            if not spam:
                transaction.on_commit(lambda: notify_staff.delay(str(msg.pk)))
        return received


class MySupportListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = SupportMessageSerializer
    filter_backends: list = []

    @extend_schema(operation_id="me_support_list")
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        # Spam foydalanuvchiga ko'rsatilmaydi (filtr signali oshkor bo'lmasin).
        return (
            SupportMessage.objects.filter(user=self.request.user)
            .exclude(status=Status.SPAM)
            .order_by("-created_at")
        )
