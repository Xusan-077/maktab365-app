"""Telegram bot (yoki boshqa tashqi mijoz) uchun qidiruv API'si: kitob topish va tayyor havolalar.

`BOT_API_TOKEN` env'i bo'sh bo'lsa endpoint yo'q kabi (404). Token `X-Bot-Token` sarlavhasida;
taqqoslash `hmac.compare_digest` bilan. Faqat nashr qilingan kitoblar; foydalanuvchi ma'lumoti yo'q.
"""

import hmac

from django.conf import settings
from django.db.models import Q
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.exceptions import APIException, NotFound
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .pdf_services import public_pdf_books

LANGUAGES = ("uz", "ru", "en")
DEFAULT_LIMIT = 5
MAX_LIMIT = 10


class BotUnauthorized(APIException):
    status_code = 401
    default_code = "bot_token_invalid"
    default_detail = "Invalid bot token."


class BotBookSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    slug = serializers.CharField()
    title = serializers.CharField(help_text="So'ralgan tildagi nom (yo'q bo'lsa `uz`)")
    grade = serializers.IntegerField()
    subject = serializers.CharField(help_text="So'ralgan tildagi fan nomi")
    page_count = serializers.IntegerField()
    size_bytes = serializers.IntegerField()
    url = serializers.URLField(help_text="Kitob sahifasi")
    read_url = serializers.URLField(help_text="Onlayn o'qish oynasi")


class BotSearchView(APIView):
    permission_classes = [AllowAny]
    authentication_classes: list = []

    @extend_schema(
        operation_id="bot_books_search",
        parameters=[
            OpenApiParameter("q", OpenApiTypes.STR, description="Nom bo'yicha qidiruv (2+ belgi)"),
            OpenApiParameter("grade", OpenApiTypes.INT, description="Sinf (1–11)"),
            OpenApiParameter("lang", OpenApiTypes.STR, enum=list(LANGUAGES)),
            OpenApiParameter("limit", OpenApiTypes.INT, description=f"1–{MAX_LIMIT}, default 5"),
        ],
        responses=BotBookSerializer(many=True),
        summary="Bot: kitob qidirish va havolalar (X-Bot-Token talab qilinadi)",
        tags=["bot"],
    )
    def get(self, request):
        expected = getattr(settings, "BOT_API_TOKEN", "")
        if not expected:
            raise NotFound()
        given = request.META.get("HTTP_X_BOT_TOKEN", "")
        if not hmac.compare_digest(given.encode(), expected.encode()):
            raise BotUnauthorized()

        params = request.query_params
        lang = params.get("lang") if params.get("lang") in LANGUAGES else "uz"
        raw_limit = params.get("limit", "")
        limit = min(max(int(raw_limit), 1), MAX_LIMIT) if raw_limit.isdigit() else DEFAULT_LIMIT

        books = public_pdf_books()
        if params.get("grade", "").isdigit():
            books = books.filter(grade=int(params["grade"]))
        query = params.get("q", "").strip()
        if len(query) >= 2:
            books = books.filter(
                Q(title__uz__icontains=query)
                | Q(title__ru__icontains=query)
                | Q(title__en__icontains=query)
            )
        elif query:
            books = books.none()

        site = settings.FRONTEND_URL
        items = []
        for book in books.select_related("subject").order_by("grade", "subject__order")[:limit]:
            base = f"{site}/{lang}/darsliklar/{book.grade}/{book.slug}"
            items.append(
                {
                    "id": book.pk,
                    "slug": book.slug,
                    "title": (book.title or {}).get(lang) or (book.title or {}).get("uz", ""),
                    "grade": book.grade,
                    "subject": (book.subject.title or {}).get(lang)
                    or (book.subject.title or {}).get("uz", ""),
                    "page_count": book.page_count,
                    "size_bytes": book.size_bytes,
                    "url": base,
                    "read_url": f"{base}/oqish",
                }
            )
        response = Response(BotBookSerializer(items, many=True).data)
        response["Cache-Control"] = "private, no-store"
        return response
