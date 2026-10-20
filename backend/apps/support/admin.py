from django.contrib import admin

from .models import SupportMessage


@admin.register(SupportMessage)
class SupportMessageAdmin(admin.ModelAdmin):
    list_display = ["created_at", "kind", "status", "email", "short_message"]
    list_filter = ["status", "kind"]
    search_fields = ["email", "name", "message", "topic"]
    list_editable = ["status"]
    readonly_fields = [
        "id",
        "user",
        "name",
        "email",
        "kind",
        "message",
        "page_url",
        "topic",
        "user_agent",
        "created_at",
        "updated_at",
    ]
    date_hierarchy = "created_at"

    @admin.display(description="Message")
    def short_message(self, obj):
        return obj.message[:80]
