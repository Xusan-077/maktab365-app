from rest_framework import serializers

from apps.content.models import PdfBook
from apps.content.pdf_serializers import PdfBookSerializer
from apps.content.serializers import LocalizedField

from .models import AnnotationColor, PdfAnnotation, PdfBookmark, PdfReadProgress, StudyGoal
from .services.events import EVENT_KINDS
from .services.goals import set_done
from .services.merge import MERGE_LIMIT
from .services.pdf import resolve_pdf_book

# --- PDF oxirgi sahifa, kutubxona, xatcho'plar ---


class PdfProgressWriteSerializer(serializers.Serializer):
    """PUT: PDF darslikda oxirgi sahifa. `updated_at` — mijozdagi yozuv vaqti."""

    last_page = serializers.IntegerField(min_value=1, max_value=100000)
    updated_at = serializers.DateTimeField(required=False)


class PdfProgressSerializer(serializers.ModelSerializer):
    pdf_book_id = serializers.UUIDField(read_only=True)
    last_page = serializers.SerializerMethodField()

    class Meta:
        model = PdfReadProgress
        fields = ["pdf_book_id", "last_page", "read_status", "updated_at"]
        read_only_fields = fields

    def get_last_page(self, row) -> int:
        # Kitob qisqa fayl bilan almashtirilgan bo'lsa ham chegaradan chiqmaydi.
        return min(row.last_page, row.pdf_book.page_count) if row.pdf_book.page_count else 1


class PdfLibraryItemSerializer(serializers.ModelSerializer):
    book = PdfBookSerializer(source="pdf_book")
    last_page = serializers.SerializerMethodField()

    class Meta:
        model = PdfReadProgress
        fields = ["book", "last_page", "read_status", "read_at", "updated_at"]
        read_only_fields = fields

    def get_last_page(self, row) -> int:
        return min(row.last_page, row.pdf_book.page_count) if row.pdf_book.page_count else 1


class PdfLibrarySerializer(serializers.Serializer):
    items = PdfLibraryItemSerializer(many=True)
    saved_count = serializers.IntegerField()


class PdfBookmarkSerializer(serializers.ModelSerializer):
    book = PdfBookSerializer(source="pdf_book")

    class Meta:
        model = PdfBookmark
        fields = ["book", "created_at"]
        read_only_fields = fields


# --- belgilar (highlight + eslatma) ---


class AnnotationRectSerializer(serializers.Serializer):
    x = serializers.FloatField(min_value=0, max_value=1)
    y = serializers.FloatField(min_value=0, max_value=1)
    w = serializers.FloatField(min_value=0, max_value=1)
    h = serializers.FloatField(min_value=0, max_value=1)


class AnnotationWriteSerializer(serializers.Serializer):
    """PUT: belgi (`id` yo'lda, mijozda yaratilgan UUID)."""

    pdf_book_id = serializers.CharField(max_length=64)
    page = serializers.IntegerField(min_value=1, max_value=100000)
    color = serializers.ChoiceField(choices=AnnotationColor.choices)
    rects = AnnotationRectSerializer(many=True, allow_empty=False, max_length=24)
    note = serializers.CharField(max_length=200, allow_blank=True, required=False, default="")


class AnnotationSerializer(serializers.ModelSerializer):
    pdf_book_id = serializers.UUIDField(read_only=True)
    rects = AnnotationRectSerializer(many=True, read_only=True)

    class Meta:
        model = PdfAnnotation
        fields = ["id", "pdf_book_id", "page", "color", "rects", "note", "updated_at"]
        read_only_fields = fields


class GuestAnnotationSerializer(AnnotationWriteSerializer):
    id = serializers.UUIDField()


# --- mehmon ma'lumotini qo'shish ---


class GuestPdfProgressSerializer(PdfProgressWriteSerializer):
    pdf_book_id = serializers.CharField(max_length=64)


class MergeRequestSerializer(serializers.Serializer):
    pdf_progress = GuestPdfProgressSerializer(many=True, required=False, max_length=MERGE_LIMIT)
    pdf_bookmarks = serializers.ListField(
        child=serializers.CharField(max_length=64), required=False, max_length=MERGE_LIMIT
    )
    pdf_annotations = GuestAnnotationSerializer(many=True, required=False, max_length=MERGE_LIMIT)


class MergeResultSerializer(serializers.Serializer):
    pdf_progress = serializers.IntegerField()
    pdf_bookmarks = serializers.IntegerField()
    pdf_annotations = serializers.IntegerField()
    failed = serializers.ListField(child=serializers.CharField())


# --- hodisalar ---


class EventSerializer(serializers.Serializer):
    """`book_opened` / `book_read`: ikkalasi ham idempotent."""

    kind = serializers.ChoiceField(choices=EVENT_KINDS)
    pdf_book_id = serializers.CharField(max_length=64)


# --- rejalar ---


class GoalSerializer(serializers.ModelSerializer):
    book = PdfBookSerializer(source="pdf_book", allow_null=True, read_only=True)
    done = serializers.SerializerMethodField()

    class Meta:
        model = StudyGoal
        fields = ["id", "title", "book", "due_date", "done", "done_at", "created_at"]
        read_only_fields = fields

    def get_done(self, goal) -> bool:
        return goal.done_at is not None


class GoalWriteSerializer(serializers.Serializer):
    """POST: title (+ kitob, muddat). PATCH: istalgan maydon; `done` bajarildi/qaytarildi."""

    title = serializers.CharField(max_length=200)
    pdf_book_id = serializers.CharField(max_length=64, required=False, allow_null=True)
    due_date = serializers.DateField(required=False, allow_null=True)
    done = serializers.BooleanField(required=False)

    def validate_title(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("blank")
        return value

    def validate_pdf_book_id(self, value) -> PdfBook | None:
        if value is None:
            return None
        return resolve_pdf_book(self.context["request"], value)

    def apply(self, goal: StudyGoal) -> StudyGoal:
        data = self.validated_data
        if "title" in data:
            goal.title = data["title"]
        if "pdf_book_id" in data:
            goal.pdf_book = data["pdf_book_id"]
        if "due_date" in data:
            goal.due_date = data["due_date"]
        if "done" in data:
            set_done(goal, data["done"])
        goal.save()
        return goal


# --- bosh sahifa va natijalar ---


class DashboardSubjectSerializer(serializers.Serializer):
    slug = serializers.SlugField()
    title = LocalizedField()
    icon = serializers.CharField(allow_blank=True)
    books_total = serializers.IntegerField()
    books_opened = serializers.IntegerField()
    books_read = serializers.IntegerField()


class WeekSerializer(serializers.Serializer):
    opened = serializers.IntegerField(help_text="Shu hafta birinchi marta ochilgan kitoblar")
    read = serializers.IntegerField(help_text="Shu hafta oxirigacha o'qilgan kitoblar")


class DashboardSerializer(serializers.Serializer):
    # `continue` Python kalit so'zi: maydon `locals()` orqali e'lon qilinadi.
    locals()["continue"] = PdfLibraryItemSerializer(allow_null=True)
    subjects = DashboardSubjectSerializer(many=True)
    review = PdfLibraryItemSerializer(many=True)
    week = WeekSerializer()
    saved_count = serializers.IntegerField()
    open_goals = serializers.IntegerField()


class TeacherGradeSerializer(serializers.Serializer):
    grade = serializers.IntegerField()
    books_total = serializers.IntegerField()
    books_opened = serializers.IntegerField()


class TeacherDashboardSerializer(DashboardSerializer):
    grades = TeacherGradeSerializer(many=True)


class ResultsSerializer(serializers.Serializer):
    read = PdfLibraryItemSerializer(many=True)
    in_progress = PdfLibraryItemSerializer(many=True)
    review = PdfLibraryItemSerializer(many=True)
    review_after_days = serializers.IntegerField()
