"""Mavzu tizimi olib tashlandi: kitob (Book), bob (Chapter), mavzu (Topic), tahrir tarixi.

Qaytarib bo'lmaydigan: jadvallar va ularning ma'lumotlari o'chadi (teskari migratsiya faqat bo'sh
jadvallarni qayta yaratadi). Fan (Subject) va PDF kitoblar (PdfBook) saqlanadi.
"""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("content", "0003_pdfbook"),
        ("learning", "0004_remove_topic_learning"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="topic",
            name="book",
        ),
        migrations.RemoveField(
            model_name="chapter",
            name="book",
        ),
        migrations.RemoveField(
            model_name="topic",
            name="chapter",
        ),
        migrations.RemoveField(
            model_name="topic",
            name="reviewed_by",
        ),
        migrations.RemoveField(
            model_name="topicrevision",
            name="topic",
        ),
        migrations.RemoveField(
            model_name="topicrevision",
            name="author",
        ),
        migrations.DeleteModel(
            name="Book",
        ),
        migrations.DeleteModel(
            name="Chapter",
        ),
        migrations.DeleteModel(
            name="Topic",
        ),
        migrations.DeleteModel(
            name="TopicRevision",
        ),
    ]
