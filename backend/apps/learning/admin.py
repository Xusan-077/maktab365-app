from django.contrib import admin

from .models import PdfBookmark, PdfReadProgress, StudyGoal


@admin.register(PdfReadProgress)
class PdfReadProgressAdmin(admin.ModelAdmin):
    list_display = ("user", "pdf_book", "last_page", "read_status", "updated_at")
    raw_id_fields = ("user", "pdf_book")


@admin.register(PdfBookmark)
class PdfBookmarkAdmin(admin.ModelAdmin):
    list_display = ("user", "pdf_book", "created_at")
    raw_id_fields = ("user", "pdf_book")


@admin.register(StudyGoal)
class StudyGoalAdmin(admin.ModelAdmin):
    list_display = ("user", "title", "due_date", "done_at")
    raw_id_fields = ("user", "pdf_book")
