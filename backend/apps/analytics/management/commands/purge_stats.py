from django.core.management.base import BaseCommand

from apps.analytics import services


class Command(BaseCommand):
    help = "Eski kunlik statistika qatorlarini o'chiradi (default: 180 kundan eski)."

    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, default=180)

    def handle(self, *args, **options):
        deleted = services.purge_older_than(options["days"])
        self.stdout.write(f"statistika: {deleted} qator o'chirildi")
