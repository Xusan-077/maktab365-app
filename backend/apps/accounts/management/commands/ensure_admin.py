import os

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import Role, User


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

        with transaction.atomic():
            user = User.objects.filter(email__iexact=email).first()
            if user is None:
                User.objects.create_superuser(email=email, password=password)
                self.stdout.write(f"Admin yaratildi: {email}")
                return
            user.role = Role.ADMIN
            user.is_staff = True
            user.is_superuser = True
            user.is_active = True
            user.set_password(password)
            user.save()
        self.stdout.write(f"Admin yangilandi: {email}")
