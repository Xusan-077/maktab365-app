from django.db import migrations

# `seed_subjects.SUBJECT_GROUPS` bilan bir xil (migratsiya kod o'zgarishidan mustaqil bo'lishi uchun nusxa).
GROUPS = {
    "matematika": "exact",
    "algebra": "exact",
    "geometriya": "exact",
    "informatika": "exact",
    "fizika": "exact",
    "chizmachilik": "exact",
    "kimyo": "natural",
    "biologiya": "natural",
    "geografiya": "natural",
    "tabiiy-fan": "natural",
    "ona-tili": "language",
    "adabiyot": "language",
    "ingliz-tili": "language",
    "rus-tili": "language",
    "tarix": "social",
    "tasviriy-san-at": "arts",
    "musiqa": "arts",
    "texnologiya": "arts",
    "jismoniy-tarbiya": "arts",
}


def fill(apps, schema_editor):
    Subject = apps.get_model("content", "Subject")
    PdfBook = apps.get_model("content", "PdfBook")
    for slug, group in GROUPS.items():
        Subject.objects.filter(slug=slug, group="").update(group=group)
    taken = set(PdfBook.objects.exclude(slug__isnull=True).values_list("slug", flat=True))
    for book in PdfBook.objects.filter(slug__isnull=True).select_related("subject").order_by(
        "created_at", "pk"
    ):
        base = f"{book.grade}-sinf-{book.subject.slug}"[:114]
        slug, n = base, 1
        while slug in taken:
            n += 1
            slug = f"{base}-{n}"
        taken.add(slug)
        PdfBook.objects.filter(pk=book.pk).update(slug=slug)


class Migration(migrations.Migration):

    dependencies = [
        ("content", "0009_pdfbook_slug_language_download_subject_group"),
    ]

    operations = [migrations.RunPython(fill, migrations.RunPython.noop)]
