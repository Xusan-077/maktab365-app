from django.contrib import admin

from .models import GameSession, Option, Question


class OptionInline(admin.TabularInline):
    model = Option
    extra = 0
    max_num = 4


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ["__str__", "topic", "difficulty", "order", "is_active"]
    list_filter = ["difficulty", "is_active"]
    inlines = [OptionInline]


@admin.register(GameSession)
class GameSessionAdmin(admin.ModelAdmin):
    list_display = ["id", "user", "game_type", "started_at", "finished_at"]
    list_filter = ["game_type"]
