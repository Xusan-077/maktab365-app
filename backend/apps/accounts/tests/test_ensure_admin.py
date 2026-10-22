import secrets

import pytest
from django.core.management import call_command

from apps.accounts.models import Role, User

pytestmark = pytest.mark.django_db


@pytest.fixture
def password():
    return secrets.token_urlsafe(18)  # testda ham qattiq kodlangan parol yo'q


@pytest.fixture
def admin_env(monkeypatch, password):
    monkeypatch.setenv("ADMIN_EMAIL", "  Boss@Example.com ")
    monkeypatch.setenv("ADMIN_PASSWORD", password)


def test_creates_superadmin(admin_env, password):
    call_command("ensure_admin")

    user = User.objects.get(email="boss@example.com")
    assert user.role == Role.ADMIN
    assert user.is_staff and user.is_superuser and user.is_active
    assert user.check_password(password)


def test_promotes_existing_user_case_insensitively(admin_env, password):
    existing = User.objects.create_user(
        email="BOSS@example.com", password=secrets.token_urlsafe(12)
    )
    existing.is_active = False
    existing.save()

    call_command("ensure_admin")

    existing.refresh_from_db()
    assert User.objects.count() == 1
    assert existing.role == Role.ADMIN
    assert existing.is_staff and existing.is_superuser and existing.is_active
    assert existing.check_password(password)


@pytest.mark.parametrize("missing", ["ADMIN_EMAIL", "ADMIN_PASSWORD"])
def test_noop_without_env(admin_env, monkeypatch, missing):
    monkeypatch.delenv(missing)

    call_command("ensure_admin")

    assert User.objects.count() == 0


def test_idempotent(admin_env):
    call_command("ensure_admin")
    call_command("ensure_admin")

    assert User.objects.filter(email__iexact="boss@example.com").count() == 1


def test_never_prints_password(admin_env, password, capsys):
    call_command("ensure_admin")

    out = capsys.readouterr()
    assert password not in out.out + out.err
