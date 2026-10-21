from django.contrib import admin

from .models import Bookmark, RecentView, StudyGoal, TopicProgress


@admin.register(TopicProgress)
class TopicProgressAdmin(admin.ModelAdmin):
    list_display = ("user", "topic", "read_status", "exercise_status", "updated_at")
    list_filter = ("read_status", "exercise_status")
    raw_id_fields = ("user", "topic")


@admin.register(Bookmark)
class BookmarkAdmin(admin.ModelAdmin):
    list_display = ("user", "kind", "topic", "book", "created_at")
    raw_id_fields = ("user", "topic", "book")


@admin.register(StudyGoal)
class StudyGoalAdmin(admin.ModelAdmin):
    list_display = ("user", "title", "due_date", "done_at")
    raw_id_fields = ("user", "topic")


@admin.register(RecentView)
class RecentViewAdmin(admin.ModelAdmin):
    list_display = ("user", "topic", "viewed_at")
    raw_id_fields = ("user", "topic")
