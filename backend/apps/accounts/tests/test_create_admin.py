import secrets

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from apps.accounts.models import Role, User

pytestmark = pytest.mark.django_db


@pytest.fixture
def password():
    return secrets.token_urlsafe(18)  # testda ham qattiq kodlangan parol yo'q


@pytest.fixture
def admin_env(monkeypatch, password):
    monkeypatch.setenv("ADMIN_EMAIL", "  Boss@Example.com ")
    monkeypatch.setenv("ADMIN_PASSWORD", password)


def test_creates_admin_with_hashed_password(admin_env, password):
    call_command("create_admin")

    user = User.objects.get(email="boss@example.com")
    assert user.role == Role.ADMIN
    assert user.is_staff and user.is_superuser and user.is_active
    assert user.check_password(password)
    assert user.password != password and "$" in user.password


def test_promotes_existing_user_and_is_idempotent(admin_env, password):
    existing = User.objects.create_user(
        email="BOSS@example.com", password=secrets.token_urlsafe(12)
    )
    existing.is_active = False
    existing.save()

    call_command("create_admin")
    call_command("create_admin")

    existing.refresh_from_db()
    assert User.objects.count() == 1
    assert existing.role == Role.ADMIN and existing.is_staff and existing.is_active
    assert existing.check_password(password)


@pytest.mark.parametrize("missing", ["ADMIN_EMAIL", "ADMIN_PASSWORD"])
def test_fails_clearly_when_env_missing(admin_env, monkeypatch, missing):
    monkeypatch.delenv(missing)

    with pytest.raises(CommandError, match=missing):
        call_command("create_admin")

    assert User.objects.count() == 0


def test_blank_values_are_missing(monkeypatch):
    monkeypatch.setenv("ADMIN_EMAIL", "   ")
    monkeypatch.setenv("ADMIN_PASSWORD", "")

    with pytest.raises(CommandError, match="ADMIN_EMAIL va ADMIN_PASSWORD"):
        call_command("create_admin")


def test_never_prints_password(admin_env, password, capsys):
    call_command("create_admin")

    out = capsys.readouterr()
    assert password not in out.out + out.err
