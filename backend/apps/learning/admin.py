from django.contrib import admin

from .models import PdfBookmark, PdfReadProgress


@admin.register(PdfReadProgress)
class PdfReadProgressAdmin(admin.ModelAdmin):
    list_display = ("user", "pdf_book", "last_page", "updated_at")
    raw_id_fields = ("user", "pdf_book")


@admin.register(PdfBookmark)
class PdfBookmarkAdmin(admin.ModelAdmin):
    list_display = ("user", "pdf_book", "created_at")
    raw_id_fields = ("user", "pdf_book")
