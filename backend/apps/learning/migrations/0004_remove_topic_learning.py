"""Mavzu tizimi o'qish ma'lumotlari olib tashlandi: mavzu progressi, eski xatcho'plar (kitob/mavzu),
maqsadlar, oxirgi ko'rilgan mavzular.

Qaytarib bo'lmaydigan: ma'lumotlar o'chadi (teskari migratsiya faqat bo'sh jadvallarni qayta
yaratadi). PDF oxirgi sahifalar (PdfReadProgress) va saqlangan PDF kitoblar (PdfBookmark) saqlanadi.
"""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("learning", "0003_pdfbookmark"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="recentview",
            name="topic",
        ),
        migrations.RemoveField(
            model_name="recentview",
            name="user",
        ),
        migrations.RemoveField(
            model_name="studygoal",
            name="topic",
        ),
        migrations.RemoveField(
            model_name="studygoal",
            name="user",
        ),
        migrations.RemoveField(
            model_name="topicprogress",
            name="topic",
        ),
        migrations.RemoveField(
            model_name="topicprogress",
            name="user",
        ),
        migrations.DeleteModel(
            name="Bookmark",
        ),
        migrations.DeleteModel(
            name="RecentView",
        ),
        migrations.DeleteModel(
            name="StudyGoal",
        ),
        migrations.DeleteModel(
            name="TopicProgress",
        ),
    ]
