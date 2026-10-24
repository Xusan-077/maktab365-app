from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("content", "0014_pdfbook_cover_covers_storage"),
    ]

    operations = [
        migrations.AddField(
            model_name="pdfbook",
            name="has_text_layer",
            field=models.BooleanField(blank=True, editable=False, null=True),
        ),
        migrations.AddField(
            model_name="pdfbook",
            name="ocr_status",
            field=models.CharField(
                choices=[
                    ("none", "Not requested"),
                    ("queued", "Queued"),
                    ("processing", "Processing"),
                    ("done", "Done"),
                    ("failed", "Failed"),
                ],
                default="none",
                editable=False,
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="pdfbook",
            name="ocr_error",
            field=models.CharField(blank=True, editable=False, max_length=64),
        ),
        migrations.AddField(
            model_name="pdfbook",
            name="ocr_updated_at",
            field=models.DateTimeField(blank=True, editable=False, null=True),
        ),
    ]
