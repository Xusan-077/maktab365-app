"""PDF.js ko'rish: sahifa rasmlari fonda tayyorlanmaydi.

Faqat QO'SHADI (eski kod bilan mos): `cover_generated`, `has_text_layer`. Mavjud `BookPage` qatorlari
va rasmlari O'CHIRILMAYDI. Eski holatlar tozalanadi: fayli bor "tayyorlanmoqda"/"xato" kitoblar
`ready` ga o'tadi (endi fonda ishlov yo'q, PDF'ning o'zi o'qiladi); yaroqsiz PDF deb belgilangan
(`invalid_pdf`) va faylsiz kitoblar o'z holicha qoladi.
"""

from django.db import migrations, models


def legacy_to_ready(apps, schema_editor):
    Book = apps.get_model("books", "Book")
    BookPage = apps.get_model("books", "BookPage")

    stuck = (
        Book.objects.filter(status__in=["processing", "failed"])
        .exclude(source_file="")
        .exclude(status_error="invalid_pdf")
    )
    stuck.update(status="ready", status_error="")

    # Matn qatlami: eski sahifalarda matn bo'lsa — bor; sahifalari bor-u matni yo'q — yo'q.
    with_pages = set(BookPage.objects.values_list("book_id", flat=True).distinct())
    with_text = set(BookPage.objects.exclude(text="").values_list("book_id", flat=True).distinct())
    Book.objects.filter(pk__in=with_text).update(has_text_layer=True)
    Book.objects.filter(pk__in=with_pages - with_text).update(has_text_layer=False)


class Migration(migrations.Migration):
    dependencies = [("books", "0003_books_annotations")]

    operations = [
        migrations.AddField(
            model_name="book",
            name="cover_generated",
            field=models.BooleanField(default=False, editable=False),
        ),
        migrations.AddField(
            model_name="book",
            name="has_text_layer",
            field=models.BooleanField(blank=True, editable=False, null=True),
        ),
        migrations.RunPython(legacy_to_ready, migrations.RunPython.noop),
    ]
