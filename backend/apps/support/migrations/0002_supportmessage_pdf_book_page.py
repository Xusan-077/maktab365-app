import uuid
from urllib.parse import parse_qs, urlparse

import django.db.models.deletion
from django.db import migrations, models


def page_of(url: str) -> int | None:
    """`…/oqish?page=12` → 12 (yaroqsiz yoki yo'q — None)."""
    value = parse_qs(urlparse(url or "").query).get("page", [""])[0]
    return int(value) if value.isdigit() and 0 < int(value) <= 100_000 else None


def backfill(apps, schema_editor):
    """Eski xabarlar: `topic` — kitob id ("Xato topdingizmi?"), bet — `page_url` dagi `?page=`."""
    SupportMessage = apps.get_model("support", "SupportMessage")
    PdfBook = apps.get_model("content", "PdfBook")
    books = set(PdfBook.objects.values_list("pk", flat=True))
    for message in SupportMessage.objects.filter(pdf_book__isnull=True).iterator():
        try:
            book_id = uuid.UUID(message.topic)
        except ValueError:
            book_id = None
        page = page_of(message.page_url)
        if book_id in books or page:
            SupportMessage.objects.filter(pk=message.pk).update(
                pdf_book_id=book_id if book_id in books else None, page=page
            )


class Migration(migrations.Migration):
    dependencies = [
        ("content", "0016_pdfbook_download_file"),
        ("support", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="supportmessage",
            name="pdf_book",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="support_messages",
                to="content.pdfbook",
            ),
        ),
        migrations.AddField(
            model_name="supportmessage",
            name="page",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddIndex(
            model_name="supportmessage",
            index=models.Index(fields=["status", "-created_at"], name="support_sup_status_053264_idx"),
        ),
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
