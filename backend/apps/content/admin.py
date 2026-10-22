from django.contrib import admin

from .models import PdfBook, Subject


@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ["slug", "order"]
    search_fields = ["slug"]


@admin.register(PdfBook)
class PdfBookAdmin(admin.ModelAdmin):
    list_display = ["id", "grade", "subject", "status", "page_count", "created_at"]
    list_filter = ["subject", "grade", "status"]
    readonly_fields = ["file", "size_bytes", "page_count"]
