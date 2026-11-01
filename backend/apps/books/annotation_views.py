"""Kirgan o'quvchining bet yozuvlari va annotatsiyalari (`/me/books/<id>/...`).

Foydalanuvchi faqat o'zinikini ko'radi: so'rovlar doim `user=request.user` bilan, begonaning
yozuvi (`id` bo'yicha ham) 404.
"""

import uuid

from django.db import transaction
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsLearner

from . import annotation_validation as validation
from .me_views import valid_page
from .models import PageAnnotation, PageNote
from .serializers import (
    AnnotationCreateSerializer,
    AnnotationUpdateSerializer,
    PageAnnotationSerializer,
    PageAnnotationsReplaceSerializer,
    PageNoteSerializer,
    PageNoteWriteSerializer,
)
from .views import visible_book

TAGS = ["books"]
MAX_PAGES_PER_REQUEST = 10


def _page_sizes(book, user, page, exclude_id=None) -> list[int]:
    rows = PageAnnotation.objects.filter(user=user, book=book, page=page)
    if exclude_id is not None:
        rows = rows.exclude(pk=exclude_id)
    return [validation.data_size(row.data) for row in rows.only("data")]


class MyPageNoteView(APIView):
    permission_classes = [IsLearner]

    @extend_schema(
        operation_id="me_books_note_retrieve",
        tags=TAGS,
        summary="Betning yon daftar yozuvi (yo'q bo'lsa bo'sh matn)",
        responses=PageNoteSerializer,
    )
    def get(self, request, pk, number):
        book = visible_book(request, pk)
        page = valid_page(book, number)
        note = PageNote.objects.filter(user=request.user, book=book, page=page).first()
        data = {"page": page, "text": note.text if note else "", "updated_at": None}
        if note:
            data["updated_at"] = note.updated_at
        return Response(PageNoteSerializer(data).data)

    @extend_schema(
        operation_id="me_books_note_update",
        tags=TAGS,
        summary="Betning yozuvini saqlash (idempotent; bo'sh matn yozuvni o'chiradi)",
        request=PageNoteWriteSerializer,
        responses=PageNoteSerializer,
    )
    def put(self, request, pk, number):
        serializer = PageNoteWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        book = visible_book(request, pk)
        page = valid_page(book, number)
        text = serializer.validated_data["text"]
        mine = PageNote.objects.filter(user=request.user, book=book, page=page)
        if not text.strip():
            mine.delete()
            return Response(PageNoteSerializer({"page": page, "text": "", "updated_at": None}).data)
        note, _ = PageNote.objects.update_or_create(
            user=request.user, book=book, page=page, defaults={"text": text}
        )
        return Response(
            PageNoteSerializer(
                {"page": page, "text": note.text, "updated_at": note.updated_at}
            ).data
        )


def _parse_pages(request, book) -> list[int]:
    raw = request.query_params.get("pages") or request.query_params.get("page") or ""
    try:
        pages = sorted({int(part) for part in raw.split(",") if part.strip()})
    except ValueError:
        raise ValidationError({"pages": ["invalid"]}) from None
    if not pages:
        raise ValidationError({"pages": ["required"]})
    if len(pages) > MAX_PAGES_PER_REQUEST:
        raise ValidationError({"pages": ["too_many_pages"]})
    for page in pages:
        valid_page(book, page)
        if page < 1:
            raise ValidationError({"pages": ["invalid"]})
    return pages


class MyAnnotationsView(APIView):
    permission_classes = [IsLearner]

    @extend_schema(
        operation_id="me_books_annotations_list",
        tags=TAGS,
        summary="Betlardagi annotatsiyalar (`pages=3,4,5` yoki `page=3`, ko'pi bilan 10 bet)",
        parameters=[
            OpenApiParameter("pages", OpenApiTypes.STR, description="Vergul bilan: 3,4,5"),
            OpenApiParameter("page", OpenApiTypes.INT, description="Bitta bet"),
        ],
        responses=PageAnnotationSerializer(many=True),
    )
    def get(self, request, pk):
        book = visible_book(request, pk)
        pages = _parse_pages(request, book)
        rows = PageAnnotation.objects.filter(user=request.user, book=book, page__in=pages).order_by(
            "page", "created_at"
        )
        return Response(PageAnnotationSerializer(rows, many=True).data)

    @extend_schema(
        operation_id="me_books_annotations_create",
        tags=TAGS,
        summary="Annotatsiya qo'shish (mijoz `id` bergan bo'lsa idempotent)",
        request=AnnotationCreateSerializer,
        responses={200: PageAnnotationSerializer, 201: PageAnnotationSerializer},
    )
    def post(self, request, pk):
        serializer = AnnotationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        book = visible_book(request, pk)
        data = serializer.validated_data
        page = valid_page(book, data["page"])
        validation.ensure_type_allowed(book, data["type"])
        annotation_id = data.get("id") or uuid.uuid4()

        existing = PageAnnotation.objects.filter(pk=annotation_id).first()
        if existing is not None:
            if (existing.user_id, existing.book_id, existing.page) != (
                request.user.pk,
                book.pk,
                page,
            ):
                raise ValidationError({"id": ["id_conflict"]})
            return Response(PageAnnotationSerializer(existing).data)

        sizes = _page_sizes(book, request.user, page) + [validation.data_size(data["data"])]
        validation.check_page_budget(sizes)
        created = PageAnnotation.objects.create(
            pk=annotation_id,
            user=request.user,
            book=book,
            page=page,
            type=data["type"],
            data=data["data"],
        )
        return Response(PageAnnotationSerializer(created).data, status=status.HTTP_201_CREATED)


class MyAnnotationDetailView(APIView):
    permission_classes = [IsLearner]

    def _get(self, request, pk, annotation_id) -> PageAnnotation:
        book = visible_book(request, pk)
        row = PageAnnotation.objects.filter(pk=annotation_id, user=request.user, book=book).first()
        if row is None:
            raise NotFound
        return row

    @extend_schema(
        operation_id="me_books_annotations_update",
        tags=TAGS,
        summary="Annotatsiya ma'lumotini yangilash (turi o'zgarmaydi)",
        request=AnnotationUpdateSerializer,
        responses=PageAnnotationSerializer,
    )
    def patch(self, request, pk, annotation_id):
        serializer = AnnotationUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        row = self._get(request, pk, annotation_id)
        data = validation.clean_data(row.type, serializer.validated_data["data"])
        sizes = _page_sizes(row.book, request.user, row.page, exclude_id=row.pk)
        validation.check_page_budget([*sizes, validation.data_size(data)])
        row.data = data
        row.save(update_fields=["data", "updated_at"])
        return Response(PageAnnotationSerializer(row).data)

    @extend_schema(
        operation_id="me_books_annotations_delete",
        tags=TAGS,
        summary="Annotatsiyani o'chirish",
        responses={204: None},
    )
    def delete(self, request, pk, annotation_id):
        self._get(request, pk, annotation_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MyPageAnnotationsView(APIView):
    permission_classes = [IsLearner]

    @extend_schema(
        operation_id="me_books_page_annotations_replace",
        tags=TAGS,
        summary="Bir betning barcha annotatsiyasini bitta so'rovda saqlash (almashtiradi)",
        request=PageAnnotationsReplaceSerializer,
        responses=PageAnnotationSerializer(many=True),
    )
    def put(self, request, pk, number):
        serializer = PageAnnotationsReplaceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        book = visible_book(request, pk)
        page = valid_page(book, number)
        items = serializer.validated_data["annotations"]
        for item in items:
            validation.ensure_type_allowed(book, item["type"])
        validation.check_page_budget([validation.data_size(item["data"]) for item in items])

        user = request.user
        with transaction.atomic():
            current = {
                row.pk: row
                for row in PageAnnotation.objects.filter(user=user, book=book, page=page)
            }
            ids = [item.get("id") or uuid.uuid4() for item in items]
            foreign = (
                PageAnnotation.objects.filter(pk__in=[i for i in ids if i not in current])
                .exclude(user=user, book=book, page=page)
                .exists()
            )
            if foreign:
                raise ValidationError({"annotations": ["id_conflict"]})

            kept = set(ids)
            PageAnnotation.objects.filter(
                pk__in=[key for key in current if key not in kept]
            ).delete()
            now = timezone.now()
            changed, created = [], []
            for annotation_id, item in zip(ids, items, strict=True):
                row = current.get(annotation_id)
                if row is None:
                    created.append(
                        PageAnnotation(
                            pk=annotation_id,
                            user=user,
                            book=book,
                            page=page,
                            type=item["type"],
                            data=item["data"],
                        )
                    )
                elif row.type != item["type"] or row.data != item["data"]:
                    row.type, row.data, row.updated_at = item["type"], item["data"], now
                    changed.append(row)
            if changed:
                PageAnnotation.objects.bulk_update(changed, ["type", "data", "updated_at"])
            if created:
                PageAnnotation.objects.bulk_create(created)
        rows = PageAnnotation.objects.filter(user=user, book=book, page=page).order_by("created_at")
        return Response(PageAnnotationSerializer(rows, many=True).data)
