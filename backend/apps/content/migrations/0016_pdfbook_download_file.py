from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("content", "0015_pdfbook_text_layer_ocr"),
    ]

    operations = [
        migrations.AddField(
            model_name="pdfbook",
            name="download_file",
            field=models.FileField(blank=True, editable=False, upload_to="pdf-books/"),
        ),
    ]
