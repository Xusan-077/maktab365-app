from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("content", "0010_fill_book_slugs_subject_groups"),
    ]

    operations = [
        migrations.AlterField(
            model_name="pdfbook",
            name="slug",
            field=models.SlugField(blank=True, max_length=120, unique=True),
        ),
    ]
