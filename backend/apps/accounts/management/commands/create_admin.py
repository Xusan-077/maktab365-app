import os

from django.core.management.base import BaseCommand, CommandError

from apps.accounts.admin_bootstrap import upsert_admin


class Command(BaseCommand):
    help = (
        "ADMIN_EMAIL va ADMIN_PASSWORD env'laridan admin yaratadi yoki bor akkauntga admin rolini "
        "beradi (idempotent). Env bo'sh bo'lsa xato bilan to'xtaydi: default parol yo'q."
    )

    def handle(self, *args, **options):
        email = os.environ.get("ADMIN_EMAIL", "").strip()
        password = os.environ.get("ADMIN_PASSWORD", "")
        missing = [
            name
            for name, value in (("ADMIN_EMAIL", email), ("ADMIN_PASSWORD", password))
            if not value
        ]
        if missing:
            raise CommandError(
                f"{' va '.join(missing)} muhit o'zgaruvchisi bo'sh. "
                "Qiymatni .env yoki prod env'da bering (kodga yozilmaydi)."
            )

        user, created = upsert_admin(email, password)
        self.stdout.write(f"Admin {'yaratildi' if created else 'yangilandi'}: {user.email}")
