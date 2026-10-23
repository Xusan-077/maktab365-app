"""Superadminni yaratish/yangilash (`ensure_admin`, `create_admin` va env orqali kirish)."""

from django.db import IntegrityError, transaction

from .models import Role, User


def _mark_env_admin(user: User) -> None:
    """Faqat bitta env admin: ADMIN_EMAIL almashsa eskisi oddiy adminga aylanadi."""
    User.objects.filter(is_env_admin=True).exclude(pk=user.pk).update(is_env_admin=False)


def upsert_admin(email: str, password: str) -> tuple[User, bool]:
    """`(user, created)`. Idempotent: bor akkauntga admin roli beriladi, parol qayta o'rnatiladi."""
    email = email.strip().lower()
    with transaction.atomic():
        user = User.objects.filter(email__iexact=email).first()
        if user is None:
            user = User.objects.create_superuser(email=email, password=password, is_env_admin=True)
            _mark_env_admin(user)
            return user, True
        user.role = Role.ADMIN
        user.is_staff = True
        user.is_superuser = True
        user.is_active = True
        user.is_env_admin = True
        user.set_password(password)
        user.save()
        _mark_env_admin(user)
        return user, False


def sync_env_admin(email: str, password: str) -> User:
    """Env bilan mos kirishdan keyin: akkaunt bor, faol va paroli env'dagiga teng.

    Parol xeshi faqat env o'zgargan bo'lsa qayta hisoblanadi (Argon2 qimmat).
    """
    email = email.strip().lower()
    user = User.objects.filter(email__iexact=email).first()
    if user is None:
        try:
            return upsert_admin(email, password)[0]
        except IntegrityError:  # ikki birinchi kirish bir vaqtda: ikkinchisi yaratilganini oladi
            user = User.objects.get(email__iexact=email)
    in_shape = (
        user.role == Role.ADMIN
        and user.is_staff
        and user.is_superuser
        and user.is_active
        and user.is_env_admin
    )
    if in_shape and user.check_password(password):
        return user
    if not user.is_env_admin:
        # Oddiy foydalanuvchi env adminga aylanmoqda: eski sessiyalari ham bekor bo'lsin.
        from .auth_services import blacklist_all

        blacklist_all(user)
    return upsert_admin(email, password)[0]
