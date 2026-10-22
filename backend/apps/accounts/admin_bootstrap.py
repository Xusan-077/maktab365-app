"""Superadminni yaratish/yangilash (`ensure_admin` va `create_admin` umumiy mantiqi)."""

from django.db import transaction

from .models import Role, User


def upsert_admin(email: str, password: str) -> tuple[User, bool]:
    """`(user, created)`. Idempotent: bor akkauntga admin roli beriladi, parol qayta o'rnatiladi."""
    email = email.strip().lower()
    with transaction.atomic():
        user = User.objects.filter(email__iexact=email).first()
        if user is None:
            return User.objects.create_superuser(email=email, password=password), True
        user.role = Role.ADMIN
        user.is_staff = True
        user.is_superuser = True
        user.is_active = True
        user.set_password(password)
        user.save()
        return user, False
