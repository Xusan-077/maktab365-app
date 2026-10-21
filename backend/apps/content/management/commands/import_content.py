from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from apps.content.importer import ContentImportError, import_content


class Command(BaseCommand):
    help = "frontend/src/content/**/*.json kontentini bazaga yuklaydi (slug bo'yicha upsert)."

    def add_arguments(self, parser):
        parser.add_argument("directory", help="Kontent ildizi, masalan ../frontend/src/content")
        parser.add_argument(
            "--dry-run", action="store_true", help="Tekshiradi va hisobot beradi, bazaga yozmaydi."
        )

    def handle(self, *args, directory, dry_run, **options):
        root = Path(directory)
        if not root.is_dir():
            raise CommandError(f"Papka topilmadi: {root}")
        try:
            report = import_content(root, dry_run=dry_run)
        except ContentImportError as error:
            for file, issue in error.problems:
                self.stderr.write(f"{file}\n  {issue.path}: {issue.message}")
            raise CommandError(
                f"Kontent xatolari: {len(error.problems)} ta, hech narsa yozilmadi."
            ) from None
        if dry_run:
            self.stdout.write("DRY-RUN: bazaga yozilmadi.")
        for line in report.lines():
            self.stdout.write(line)
