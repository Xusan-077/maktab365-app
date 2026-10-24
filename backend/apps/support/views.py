import uuid
from urllib.parse import parse_qs, urlparse

import structlog
from django.db import transaction
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.content.models import PdfBook
from apps.core.throttling import SupportBurstThrottle, SupportRateThrottle

from .models import Status, SupportMessage
from .serializers import (
    SupportCreateSerializer,
    SupportMessageSerializer,
    SupportReceivedSerializer,
)
from .spam import is_spam
from .tasks import notify_staff

log = structlog.get_logger()

MAX_PAGE = 100_000


def _book_and_page(data) -> tuple[PdfBook | None, int | None]:
    """Kitob: `pdf_book` yoki (eski klient) `topic` id; bet: `page` yoki `page_url` `?page=`."""
    book_id = data.get("pdf_book")
    if book_id is None:
        try:
            book_id = uuid.UUID(data.get("topic") or "")
        except ValueError:
            book_id = None
    book = PdfBook.objects.filter(pk=book_id).first() if book_id else None
    page = data.get("page")
    if page is None:
        raw = parse_qs(urlparse(data.get("page_url") or "").query).get("page", [""])[0]
        page = int(raw) if raw.isdigit() and 0 < int(raw) <= MAX_PAGE else None
    return book, page


class SupportCreateView(APIView):
    permission_classes = [AllowAny]
    # Soatiga 5 ta va ketma-ket (daqiqada 2 ta) — ikkalasi ham IP bo'yicha.
    throttle_classes = [SupportBurstThrottle, SupportRateThrottle]

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
        book, page = _book_and_page(data)
        with transaction.atomic():
            msg = SupportMessage.objects.create(
                user=user,
                name=data["name"],
                email=data["email"] or (user.email if user and user.email else ""),
                kind=data["kind"],
                message=data["message"],
                page_url=data["page_url"],
                topic=data["topic"],
                pdf_book=book,
                page=page,
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
