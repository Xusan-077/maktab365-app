"""Katalog turi (`BookType` modeli) va o'qish rejimi (`reading_mode`) ajratiladi.

Eski `Book.type` (textbook/fiction/math/test/other) ikkiga bo'linadi:
- `reading_mode`: fiction/math/test o'z holicha, textbook/other -> standard;
- `book_type` (katalog guruhi): textbook -> "Maktab darsliklari", fiction -> "Badiiy kitoblar",
  qolgani -> "Boshqa".
Orqaga qaytarishda `type` shu ikki maydondan tiklanadi (ma'lumot yo'qolmaydi).
"""

import uuid

import django.db.models.deletion
from django.db import migrations, models

import apps.books.models
import apps.content.storage
import apps.core.fields

SEED = [
    ("maktab-darsliklari", {"uz": "Maktab darsliklari", "ru": "Школьные учебники", "en": "School textbooks"}, 10, True),
    ("badiiy-kitoblar", {"uz": "Badiiy kitoblar", "ru": "Художественные книги", "en": "Fiction"}, 20, False),
    ("boshqa", {"uz": "Boshqa", "ru": "Другое", "en": "Other"}, 100, False),
]

OLD_TO_TYPE = {"textbook": "maktab-darsliklari", "fiction": "badiiy-kitoblar"}
OLD_TO_MODE = {"fiction": "fiction", "math": "math", "test": "test"}


def forwards(apps, schema_editor):
    BookType = apps.get_model("books", "BookType")
    Book = apps.get_model("books", "Book")
    types = {}
    for slug, name, order, system in SEED:
        obj, _ = BookType.objects.get_or_create(
            slug=slug,
            defaults={"id": uuid.uuid4(), "name": name, "order": order, "is_system": system},
        )
        types[slug] = obj
    taken = set()
    for book in Book.objects.all().order_by("created_at", "pk"):
        base = apps_make_slug(book.title)
        slug, n = base, 1
        while slug in taken:
            n += 1
            slug = f"{base}-{n}"
        taken.add(slug)
        book.slug = slug
        book.book_type = types[OLD_TO_TYPE.get(book.type, "boshqa")]
        book.reading_mode = OLD_TO_MODE.get(book.type, "standard")
        book.save(update_fields=["slug", "book_type", "reading_mode"])


def backwards(apps, schema_editor):
    Book = apps.get_model("books", "Book")
    for book in Book.objects.select_related("book_type"):
        if book.reading_mode in ("fiction", "math", "test"):
            old = book.reading_mode
        elif book.book_type.slug == "maktab-darsliklari":
            old = "textbook"
        else:
            old = "other"
        Book.objects.filter(pk=book.pk).update(type=old)


def apps_make_slug(title):
    return apps.books.models.make_slug(title)


class Migration(migrations.Migration):
    dependencies = [
        ("books", "0006_books_modes"),
    ]

    operations = [
        migrations.CreateModel(
            name="BookType",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", apps.core.fields.LocalizedTextField(default=dict)),
                ("slug", models.SlugField(max_length=120, unique=True)),
                ("order", models.PositiveIntegerField(default=0)),
                ("is_active", models.BooleanField(default=True)),
                ("is_system", models.BooleanField(default=False, editable=False)),
            ],
            options={"ordering": ["order", "slug"]},
        ),
        migrations.AddField(
            model_name="book",
            name="slug",
            field=models.CharField(max_length=120, blank=True, null=True),
        ),
        migrations.AddField(
            model_name="book",
            name="book_type",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="books",
                to="books.booktype",
            ),
        ),
        migrations.AddField(
            model_name="book",
            name="cover_small",
            field=models.FileField(
                blank=True,
                editable=False,
                storage=apps.content.storage.covers_storage,
                upload_to="covers/",
            ),
        ),
        migrations.AddField(
            model_name="book",
            name="reading_mode",
            field=models.CharField(
                choices=[
                    ("standard", "Oddiy"),
                    ("fiction", "Badiiy kitob"),
                    ("math", "Matematika"),
                    ("test", "Test to'plami"),
                ],
                db_index=True,
                default="standard",
                max_length=16,
            ),
        ),
        migrations.RunPython(forwards, backwards),
        migrations.RemoveIndex(model_name="book", name="books_book_type_32f6e0_idx"),
        migrations.RemoveField(model_name="book", name="type"),
        migrations.AlterField(
            model_name="book",
            name="slug",
            field=models.SlugField(max_length=120, blank=True, unique=True),
        ),
        migrations.AlterField(
            model_name="book",
            name="book_type",
            field=models.ForeignKey(
                default=apps.books.models.default_book_type_id,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="books",
                to="books.booktype",
            ),
        ),
        migrations.AddIndex(
            model_name="book",
            index=models.Index(
                fields=["book_type", "is_published", "status"], name="books_book_book_ty_1d2a43_idx"
            ),
        ),
    ]
