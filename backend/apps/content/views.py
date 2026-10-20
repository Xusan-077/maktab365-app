from django.db.models import Count, Prefetch, Q
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, serializers
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .cache import is_staff, public_cached, request_locale, show_drafts
from .models import Book, Chapter, Subject, Topic, TopicStatus
from .search import make_snippet, query_terms, search_topics
from .serializers import (
    BookDetailSerializer,
    BookSerializer,
    GradeSerializer,
    SearchResponseSerializer,
    SubjectSerializer,
    TopicDetailSerializer,
)

GRADES = range(1, 12)
SEARCH_LIMIT_DEFAULT, SEARCH_LIMIT_MAX = 20, 50

GRADE_PARAM = OpenApiParameter("grade", OpenApiTypes.INT, description="Sinf (1–11)")
SUBJECT_PARAM = OpenApiParameter("subject", OpenApiTypes.STR, description="Fan slug'i")
LOCALE_PARAM = OpenApiParameter(
    "locale",
    OpenApiTypes.STR,
    enum=["uz", "ru", "en"],
    description="Til (yoki Accept-Language); hozir faqat qidiruv snippetini tanlaydi.",
)


def _int_param(request, name: str) -> int | None:
    raw = request.query_params.get(name)
    if raw in (None, ""):
        return None
    try:
        return int(raw)
    except ValueError:
        raise serializers.ValidationError({name: ["invalid"]}) from None


def _visible_topics(request):
    """Foydalanuvchiga ko'rinadigan mavzular."""
    topics = Topic.objects.all()
    return topics if show_drafts(request) else topics.filter(status=TopicStatus.PUBLISHED)


def _visible_books(request):
    """Ko'rinadigan kitoblar + `visible_topics` (ko'rinadigan mavzular soni)."""
    topic_filter = None if show_drafts(request) else Q(topics__status=TopicStatus.PUBLISHED)
    books = Book.objects.select_related("subject").annotate(
        visible_topics=Count("topics", filter=topic_filter)
    )
    return books if is_staff(request.user) else books.filter(is_published=True)


class PublicView:
    """Ochiq (loginsiz) o'qish uchun umumiy sozlama; tezlik chegarasi o'rniga kesh ishlaydi."""

    permission_classes = [AllowAny]
    throttle_classes: list = []


class GradeListView(PublicView, APIView):
    @extend_schema(
        operation_id="grades_list",
        responses=GradeSerializer(many=True),
        summary="Sinflar (1–11) va ulardagi kitoblar soni",
        tags=["content"],
    )
    @public_cached
    def get(self, request):
        books = (
            Book.objects.all() if is_staff(request.user) else Book.objects.filter(is_published=True)
        )
        counts = dict(
            books.order_by().values("grade").annotate(n=Count("pk")).values_list("grade", "n")
        )
        return Response([{"grade": g, "books_count": counts.get(g, 0)} for g in GRADES])


class SubjectListView(PublicView, APIView):
    @extend_schema(
        operation_id="subjects_list",
        parameters=[GRADE_PARAM],
        responses=SubjectSerializer(many=True),
        summary="Kitobi bor fanlar (ixtiyoriy: sinf bo'yicha)",
        tags=["content"],
    )
    @public_cached
    def get(self, request):
        grade = _int_param(request, "grade")
        book_filter = Q() if is_staff(request.user) else Q(books__is_published=True)
        if grade is not None:
            book_filter &= Q(books__grade=grade)
        subjects = (
            Subject.objects.annotate(books_count=Count("books", filter=book_filter))
            .filter(books_count__gt=0)
            .order_by("order", "slug")
        )
        return Response(SubjectSerializer(subjects, many=True).data)


class BookListView(PublicView, generics.ListAPIView):
    serializer_class = BookSerializer
    filter_backends: list = []

    def get_queryset(self):
        request = self.request
        books = _visible_books(request)
        grade = _int_param(request, "grade")
        if grade is not None:
            books = books.filter(grade=grade)
        if subject := request.query_params.get("subject"):
            books = books.filter(subject__slug=subject)
        if query := request.query_params.get("q", "").strip():
            books = books.filter(
                Q(title__uz__icontains=query)
                | Q(title__ru__icontains=query)
                | Q(title__en__icontains=query)
                | Q(author__uz__icontains=query)
            )
        ready = request.query_params.get("topics_ready")
        if ready in ("true", "1"):
            books = books.filter(visible_topics__gt=0)
        elif ready in ("false", "0"):
            books = books.filter(visible_topics=0)
        return books.order_by("grade", "order", "slug")

    @extend_schema(
        operation_id="books_list",
        parameters=[
            GRADE_PARAM,
            SUBJECT_PARAM,
            OpenApiParameter("q", OpenApiTypes.STR, description="Kitob nomi/muallifi bo'yicha"),
            OpenApiParameter(
                "topics_ready", OpenApiTypes.BOOL, description="Mavzulari bor/yo'q kitoblar"
            ),
        ],
        summary="Kitoblar (sahifalangan)",
        tags=["content"],
    )
    @public_cached
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


class BookDetailView(PublicView, APIView):
    @extend_schema(
        operation_id="books_retrieve",
        responses=BookDetailSerializer,
        summary="Kitob: boblar va mavzular ro'yxati (bloklarsiz)",
        tags=["content"],
    )
    @public_cached
    def get(self, request, slug):
        book = _visible_books(request).filter(slug=slug).first()
        if book is None:
            raise NotFound("Kitob topilmadi.")
        topics = (
            _visible_topics(request)
            .only("slug", "order", "title", "summary", "status", "chapter_id", "book_id")
            .order_by("order")
        )
        book.chapter_list = list(
            Chapter.objects.filter(book=book)
            .prefetch_related(Prefetch("topics", queryset=topics, to_attr="visible_topic_list"))
            .order_by("order")
        )
        return Response(BookDetailSerializer(book, context={"request": request}).data)


class TopicDetailView(PublicView, APIView):
    @extend_schema(
        operation_id="topics_retrieve",
        responses=TopicDetailSerializer,
        summary="Mavzu: to'liq bloklar, oldingi/keyingi mavzu, breadcrumb",
        tags=["content"],
    )
    @public_cached
    def get(self, request, book, topic):
        visible = _visible_topics(request)
        if not is_staff(request.user):
            visible = visible.filter(book__is_published=True)
        current = (
            visible.select_related("chapter", "book__subject")
            .filter(book__slug=book, slug=topic)
            .first()
        )
        if current is None:
            raise NotFound("Mavzu topilmadi.")
        ordered = list(
            visible.filter(book=current.book)
            .select_related("chapter")
            .only("slug", "title", "order", "chapter__order")
            .order_by("chapter__order", "order")
        )
        index = next(i for i, item in enumerate(ordered) if item.pk == current.pk)
        current.previous = ordered[index - 1] if index > 0 else None
        current.next = ordered[index + 1] if index + 1 < len(ordered) else None
        return Response(TopicDetailSerializer(current, context={"request": request}).data)


class SearchView(PublicView, APIView):
    # Qidiruv DB'ga og'ir: umumiy (anon/user) tezlik chegarasi saqlanadi.
    throttle_classes = APIView.throttle_classes

    @extend_schema(
        operation_id="search_topics",
        parameters=[
            OpenApiParameter("q", OpenApiTypes.STR, required=True, description="Qidiruv so'rovi"),
            GRADE_PARAM,
            SUBJECT_PARAM,
            OpenApiParameter("book", OpenApiTypes.STR, description="Kitob slug'i"),
            LOCALE_PARAM,
            OpenApiParameter(
                "limit", OpenApiTypes.INT, description=f"Eng ko'pi {SEARCH_LIMIT_MAX} ta"
            ),
        ],
        responses=SearchResponseSerializer,
        summary="Mavzular bo'yicha qidiruv (lotin va kirill)",
        tags=["content"],
    )
    @public_cached
    def get(self, request):
        terms = query_terms(request.query_params.get("q", ""))
        if not terms:
            return Response({"count": 0, "results": []})
        topics = _visible_topics(request).select_related("chapter", "book__subject")
        if not is_staff(request.user):
            topics = topics.filter(book__is_published=True)
        if (grade := _int_param(request, "grade")) is not None:
            topics = topics.filter(book__grade=grade)
        if subject := request.query_params.get("subject"):
            topics = topics.filter(book__subject__slug=subject)
        if book := request.query_params.get("book"):
            topics = topics.filter(book__slug=book)
        limit = min(_int_param(request, "limit") or SEARCH_LIMIT_DEFAULT, SEARCH_LIMIT_MAX)
        matches = search_topics(topics, terms)
        found = list(matches[:limit])
        locale = request_locale(request)
        for topic in found:
            topic.snippet = make_snippet(topic, terms, locale)
        count = len(found) if len(found) < limit else matches.count()
        return Response(SearchResponseSerializer({"count": count, "results": found}).data)
