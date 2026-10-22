import os

from django.core.management.base import BaseCommand

from apps.accounts.admin_bootstrap import upsert_admin


class Command(BaseCommand):
    help = (
        "ADMIN_EMAIL va ADMIN_PASSWORD env'laridan superadminni yaratadi yoki yangilaydi "
        "(idempotent). Env bo'sh bo'lsa hech narsa qilmaydi."
    )

    def handle(self, *args, **options):
        email = os.environ.get("ADMIN_EMAIL", "").strip().lower()
        password = os.environ.get("ADMIN_PASSWORD", "")
        if not email or not password:
            self.stdout.write("ADMIN_EMAIL/ADMIN_PASSWORD berilmagan — o'tkazib yuborildi.")
            return

        _user, created = upsert_admin(email, password)
        self.stdout.write(f"Admin {'yaratildi' if created else 'yangilandi'}: {email}")
