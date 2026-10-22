from django.contrib import admin

from .models import Book, Chapter, PdfBook, Subject, Topic, TopicRevision


class ChapterInline(admin.TabularInline):
    model = Chapter
    extra = 0
    fields = ["order", "slug", "title"]
    show_change_link = True


class TopicInline(admin.TabularInline):
    model = Topic
    extra = 0
    fields = ["order", "slug", "title", "summary", "status", "blocks"]
    show_change_link = True


@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ["slug", "order"]
    search_fields = ["slug"]


@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    list_display = ["slug", "subject", "grade", "is_published", "topics_ready", "order"]
    list_filter = ["subject", "grade", "is_published", "topics_ready"]
    search_fields = ["slug"]
    inlines = [ChapterInline]


@admin.register(Chapter)
class ChapterAdmin(admin.ModelAdmin):
    list_display = ["slug", "book", "order"]
    list_filter = ["book__subject", "book"]
    search_fields = ["slug", "book__slug"]
    inlines = [TopicInline]


class TopicRevisionInline(admin.TabularInline):
    model = TopicRevision
    extra = 0
    fields = ["created_at", "author", "comment"]
    readonly_fields = fields
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Topic)
class TopicAdmin(admin.ModelAdmin):
    list_display = ["slug", "book", "chapter", "order", "status", "reviewed_at", "published_at"]
    list_filter = ["status", "book__subject", "book"]
    search_fields = ["slug", "book__slug"]
    readonly_fields = ["reviewed_at", "published_at"]
    raw_id_fields = ["reviewed_by"]
    inlines = [TopicRevisionInline]

    def save_model(self, request, obj, form, change):
        obj.revision_author = request.user
        obj.revision_comment = "admin"
        super().save_model(request, obj, form, change)


@admin.register(TopicRevision)
class TopicRevisionAdmin(admin.ModelAdmin):
    list_display = ["topic", "author", "comment", "created_at"]
    readonly_fields = ["topic", "title", "blocks", "author", "comment", "created_at"]

    def has_add_permission(self, request):
        return False


@admin.register(PdfBook)
class PdfBookAdmin(admin.ModelAdmin):
    list_display = ["id", "grade", "subject", "status", "page_count", "created_at"]
    list_filter = ["subject", "grade", "status"]
    readonly_fields = ["file", "size_bytes", "page_count"]
