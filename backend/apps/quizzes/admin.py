from django.contrib import admin

from .models import Quiz, QuizAttempt, QuizCategory


@admin.register(Quiz)
class QuizAdmin(admin.ModelAdmin):
    list_display = ["title", "teacher", "visibility", "updated_at"]
    list_filter = ["visibility"]


admin.site.register(QuizCategory)
admin.site.register(QuizAttempt)
