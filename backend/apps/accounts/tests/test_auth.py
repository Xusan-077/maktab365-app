import re
from datetime import timedelta
from unittest import mock

import pytest
from django.core import mail
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken

from apps.accounts import auth_services
from apps.accounts.models import AuthEvent, Identity, Profile, User, VerificationToken

pytestmark = pytest.mark.django_db

PASSWORD = "kuchli-parol-2026"
NEW_PASSWORD = "yangi-parol-2027"


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


class Client:
    """APIClient + `transaction.on_commit` (Celery task'lari) so'rov ichida bajariladi."""

    def __init__(self, capture):
        self.api = APIClient()
        self.capture = capture

    def post(self, path, data=None, **extra):
        with self.capture(execute=True):
            return self.api.post(f"/api/v1/auth/{path}", data or {}, format="json", **extra)

    def get(self, path, **extra):
        return self.api.get(path, **extra)

    def bearer(self, access):
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        return self


@pytest.fixture
def client(django_capture_on_commit_callbacks):
    return Client(django_capture_on_commit_callbacks)


@pytest.fixture
def make_client(django_capture_on_commit_callbacks):
    return lambda: Client(django_capture_on_commit_callbacks)


def register(client, email="ali@example.com", password=PASSWORD, **extra):
    return client.post("register/", {"email": email, "password": password, **extra})


def login(client, email="ali@example.com", password=PASSWORD, **extra):
    return client.post("login/", {"email": email, "password": password}, **extra)


def token_from_mail(message) -> str:
    return re.search(r"token=([\w-]+)", message.body).group(1)


def event_types(user) -> list[str]:
    return list(AuthEvent.objects.filter(user=user).values_list("type", flat=True))


@pytest.fixture
def user():
    user = User.objects.create_user(email="ali@example.com", password=PASSWORD)
    user.email_verified_at = timezone.now()
    user.save()
    return user


# --- to'liq oqim ---


class TestFullFlow:
    def test_register_verify_login_refresh_logout(self, client, make_client):
        response = register(client, email="Ali@Example.com", display_name="Ali", locale="ru")
        assert response.status_code == 201
        body = response.json()
        assert body["is_new"] is True
        assert body["access"] and body["refresh"]
        assert body["user"]["email"] == "ali@example.com"
        assert body["user"]["email_verified"] is False
        assert body["user"]["profile"]["display_name"] == "Ali"
        assert body["user"]["profile"]["locale"] == "ru"

        # Tasdiqlanmagan foydalanuvchi ham kira oladi; me/ da flag false.
        me = make_client().bearer(body["access"]).get("/api/v1/me/")
        assert me.status_code == 200
        assert me.json()["email_verified"] is False

        assert len(mail.outbox) == 1
        verify = client.post("email/verify/", {"token": token_from_mail(mail.outbox[0])})
        assert verify.status_code == 200
        assert verify.json() == {"ok": True}

        session = login(client, email="ALI@example.com")
        assert session.status_code == 200
        session = session.json()
        assert session["is_new"] is False
        assert session["user"]["email_verified"] is True

        refreshed = client.post("refresh/", {"refresh": session["refresh"]})
        assert refreshed.status_code == 200
        pair = refreshed.json()
        assert set(pair) == {"access", "refresh"}
        assert pair["refresh"] != session["refresh"]
        assert make_client().bearer(pair["access"]).get("/api/v1/me/").status_code == 200

        # Rotation: eski refresh endi ishlamaydi.
        reused = client.post("refresh/", {"refresh": session["refresh"]})
        assert reused.status_code == 401
        assert reused.json()["code"] == "token_not_valid"

        assert client.post("logout/", {"refresh": pair["refresh"]}).status_code == 204
        assert client.post("refresh/", {"refresh": pair["refresh"]}).status_code == 401

        user = User.objects.get(email="ali@example.com")
        assert {
            "registered",
            "email_verification_sent",
            "email_verified",
            "login",
            "logout",
        } <= set(event_types(user))

    def test_register_creates_password_identity_and_profile(self, client):
        register(client, display_name="  Vali  ")
        user = User.objects.get(email="ali@example.com")
        assert user.check_password(PASSWORD)
        assert user.profile.display_name == "Vali"
        assert user.profile.locale == "uz"
        assert user.profile.onboarded_at is None
        identity = Identity.objects.get(user=user)
        assert identity.provider == "password" and identity.verified is False

    def test_verify_marks_identity_verified(self, client):
        register(client)
        client.post("email/verify/", {"token": token_from_mail(mail.outbox[0])})
        user = User.objects.get(email="ali@example.com")
        assert user.email_verified_at is not None
        assert Identity.objects.get(user=user).verified is True


# --- ro'yxatdan o'tish validatsiyasi ---


class TestRegisterValidation:
    def test_duplicate_email_case_insensitive(self, client, user):
        response = register(client, email="ALI@example.com")
        assert response.status_code == 400
        assert response.json()["details"] == {"email": ["email_taken"]}

    @pytest.mark.parametrize(
        ("password", "code"),
        [
            ("short1", "password_too_short"),
            ("password123", "password_too_common"),
            ("1234567890123", "password_entirely_numeric"),
        ],
    )
    def test_weak_password_codes(self, client, password, code):
        response = register(client, password=password)
        assert response.status_code == 400
        assert code in response.json()["details"]["password"]
        assert not User.objects.filter(email="ali@example.com").exists()

    def test_password_similar_to_email(self, client):
        response = register(client, email="samarqand2026@example.com", password="samarqand2026")
        assert "password_too_similar" in response.json()["details"]["password"]

    def test_invalid_email(self, client):
        response = register(client, email="not-an-email")
        assert response.status_code == 400
        assert "email" in response.json()["details"]

    def test_stale_bearer_does_not_break_register(self, client):
        client.api.credentials(HTTP_AUTHORIZATION="Bearer expired.garbage.token")
        assert register(client).status_code == 201


# --- kirish ---


class TestLogin:
    def test_wrong_password(self, client, user):
        response = login(client, password="noto'g'ri-parol")
        assert response.status_code == 401
        assert response.json()["code"] == "invalid_credentials"
        assert "login_failed" in event_types(user)

    def test_unknown_email_looks_identical(self, client, user):
        wrong = login(client, password="noto'g'ri-parol")
        unknown = login(client, email="hech-kim@example.com")
        assert unknown.status_code == wrong.status_code == 401
        assert unknown.json() == wrong.json()

    def test_unknown_email_still_hashes(self, client):
        with mock.patch.object(User, "set_password", autospec=True) as hashed:
            login(client, email="hech-kim@example.com")
        hashed.assert_called_once()

    def test_passwordless_account_still_hashes(self, client):
        User.objects.create_user(email="google@example.com")
        with mock.patch.object(User, "set_password", autospec=True) as hashed:
            response = login(client, email="google@example.com")
        assert response.status_code == 401
        hashed.assert_called_once()

    def test_inactive_user(self, client, user):
        user.is_active = False
        user.save()
        assert login(client).json()["code"] == "invalid_credentials"

    def test_deleted_user(self, client, user):
        from apps.accounts.services import delete_account

        delete_account(user)
        assert login(client).status_code == 401

    def test_updates_last_login(self, client, user):
        login(client)
        user.refresh_from_db()
        assert user.last_login is not None


# --- bloklash va throttle ---


class TestLockout:
    def test_locks_after_consecutive_failures(self, client, user, settings):
        settings.AUTH_LOCKOUT_THRESHOLD = 3
        assert login(client, password="x-wrong-1").status_code == 401
        assert login(client, password="x-wrong-2").status_code == 401
        locked = login(client, password="x-wrong-3")
        assert locked.status_code == 429
        assert locked.json()["code"] == "login_locked"
        assert int(locked["Retry-After"]) > 0
        # To'g'ri parol ham bloklangan paytda o'tmaydi.
        assert login(client).json()["code"] == "login_locked"
        assert "login_locked" in event_types(user)

    def test_unknown_email_locks_the_same_way(self, client, settings):
        settings.AUTH_LOCKOUT_THRESHOLD = 2
        login(client, email="hech-kim@example.com")
        assert login(client, email="hech-kim@example.com").json()["code"] == "login_locked"

    def test_success_resets_counter(self, client, user, settings):
        settings.AUTH_LOCKOUT_THRESHOLD = 3
        login(client, password="x-wrong-1")
        login(client, password="x-wrong-2")
        assert login(client).status_code == 200
        login(client, password="x-wrong-3")
        assert login(client, password="x-wrong-4").status_code == 401

    def test_lock_expires(self, client, user, settings):
        settings.AUTH_LOCKOUT_THRESHOLD = 1
        assert login(client, password="x-wrong").status_code == 429
        cache.clear()  # Redis'da TTL tugashi
        assert login(client).status_code == 200


class TestThrottle:
    def test_ip_throttle(self, client, settings):
        settings.REST_FRAMEWORK = {
            **settings.REST_FRAMEWORK,
            "DEFAULT_THROTTLE_RATES": {
                **settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"],
                "auth": "3/min",
            },
        }
        statuses = [login(client, email=f"u{i}@example.com").status_code for i in range(4)]
        assert statuses[:3] == [401, 401, 401]
        assert statuses[3] == 429
        throttled = login(client, email="other@example.com")
        assert throttled.json()["code"] == "throttled"

    def test_email_throttle_across_ips(self, client, settings):
        settings.REST_FRAMEWORK = {
            **settings.REST_FRAMEWORK,
            "DEFAULT_THROTTLE_RATES": {
                **settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"],
                "auth_email": "2/min",
            },
        }
        statuses = [
            client.post(
                "password/forgot/", {"email": "ali@example.com"}, REMOTE_ADDR=f"10.0.0.{i}"
            ).status_code
            for i in range(3)
        ]
        assert statuses == [200, 200, 429]
        other = client.post("password/forgot/", {"email": "vali@example.com"})
        assert other.status_code == 200


def throttle_rates(settings, **rates):
    settings.REST_FRAMEWORK = {
        **settings.REST_FRAMEWORK,
        "DEFAULT_THROTTLE_RATES": {**settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"], **rates},
    }


class TestThrottleEndpoints:
    @pytest.mark.parametrize(
        ("path", "payload"),
        [
            ("register/", {"email": "n{i}@example.com", "password": PASSWORD}),
            ("login/", {"email": "n{i}@example.com", "password": PASSWORD}),
            ("email/verify/", {"token": "t{i}"}),
            ("password/forgot/", {"email": "n{i}@example.com"}),
            ("password/reset/", {"token": "t{i}", "password": PASSWORD}),
        ],
    )
    def test_ip_throttle(self, client, settings, path, payload):
        throttle_rates(settings, auth="3/min")
        statuses = [
            client.post(path, {k: v.format(i=i) for k, v in payload.items()}).status_code
            for i in range(5)
        ]
        assert 429 not in statuses[:3]
        assert statuses[3:] == [429, 429]

    @pytest.mark.parametrize(
        ("path", "payload"),
        [
            ("register/", {"email": "same@example.com", "password": PASSWORD}),
            ("login/", {"email": "same@example.com", "password": PASSWORD}),
            ("password/forgot/", {"email": "same@example.com"}),
        ],
    )
    def test_email_throttle_across_ips(self, client, settings, path, payload):
        throttle_rates(settings, auth_email="2/min")
        statuses = [
            client.post(path, payload, REMOTE_ADDR=f"10.1.0.{i}").status_code for i in range(4)
        ]
        assert 429 not in statuses[:2]
        assert statuses[2:] == [429, 429]


# --- refresh / logout ---


class TestTokens:
    def test_garbage_refresh(self, client):
        response = client.post("refresh/", {"refresh": "garbage"})
        assert response.status_code == 401
        assert response.json()["code"] == "token_not_valid"

    def test_access_token_is_not_a_refresh_token(self, client, user):
        access = login(client).json()["access"]
        assert client.post("refresh/", {"refresh": access}).status_code == 401

    def test_refresh_for_deleted_user(self, client, user):
        from apps.accounts.services import delete_account

        refresh = login(client).json()["refresh"]
        delete_account(user)
        assert client.post("refresh/", {"refresh": refresh}).status_code == 401

    def test_refresh_for_inactive_user(self, client, user):
        refresh = login(client).json()["refresh"]
        user.is_active = False
        user.save()
        assert client.post("refresh/", {"refresh": refresh}).status_code == 401

    def test_logout_is_idempotent(self, client, user):
        refresh = login(client).json()["refresh"]
        assert client.post("logout/", {"refresh": refresh}).status_code == 204
        assert client.post("logout/", {"refresh": refresh}).status_code == 204
        assert client.post("logout/", {"refresh": "garbage"}).status_code == 204

    def test_logout_all(self, client, make_client, user):
        first = login(client).json()
        second = login(client).json()
        response = make_client().bearer(first["access"]).post("logout-all/")
        assert response.status_code == 204
        for session in (first, second):
            assert client.post("refresh/", {"refresh": session["refresh"]}).status_code == 401
        assert "logout_all" in event_types(user)

    def test_logout_all_requires_auth(self, client):
        assert client.post("logout-all/").status_code == 401


class TestRefreshReuse:
    @staticmethod
    def sessions(client):
        """Ildiz (aylantirilgan), uning bolasi va boshqa qurilma sessiyasi."""
        root = login(client).json()["refresh"]
        other = login(client).json()["refresh"]
        child = client.post("refresh/", {"refresh": root}).json()["refresh"]
        return root, child, other

    @staticmethod
    def age_blacklist(seconds):
        BlacklistedToken.objects.update(blacklisted_at=timezone.now() - timedelta(seconds=seconds))

    def refresh_status(self, client, token):
        return client.post("refresh/", {"refresh": token}).status_code

    def test_reuse_after_grace_revokes_family(self, client, user, settings):
        root, child, other = self.sessions(client)
        self.age_blacklist(settings.REFRESH_REUSE_GRACE_SECONDS + 1)
        assert self.refresh_status(client, root) == 401
        assert self.refresh_status(client, child) == 401
        assert self.refresh_status(client, other) == 401

    def test_reuse_within_grace_keeps_family(self, client, user):
        root, child, other = self.sessions(client)
        assert self.refresh_status(client, root) == 401
        assert "refresh_reuse_detected" not in event_types(user)
        assert self.refresh_status(client, child) == 200
        assert self.refresh_status(client, other) == 200

    def test_reuse_is_audited_without_secrets(self, client, user, settings):
        root, child, other = self.sessions(client)
        self.age_blacklist(settings.REFRESH_REUSE_GRACE_SECONDS + 1)
        client.post(
            "refresh/", {"refresh": root}, REMOTE_ADDR="203.0.113.7", HTTP_USER_AGENT="probe/1.0"
        )
        event = AuthEvent.objects.get(user=user, type="refresh_reuse_detected")
        assert event.ip == "203.0.113.7"
        assert event.user_agent == "probe/1.0"
        assert event.meta == {"revoked_sessions": 2}
        dump = str(event.meta) + event.user_agent
        assert all(token not in dump for token in (root, child, other))

    def test_reuse_does_not_touch_other_users(self, client, user, settings):
        bystander = User.objects.create_user(email="vali@example.com", password=PASSWORD)
        theirs = login(client, email=bystander.email).json()["refresh"]
        root, *_ = self.sessions(client)
        self.age_blacklist(settings.REFRESH_REUSE_GRACE_SECONDS + 1)
        client.post("refresh/", {"refresh": root})
        assert self.refresh_status(client, theirs) == 200


# --- email tasdiqlash tokenlari ---


class TestEmailVerification:
    def test_token_stored_hashed(self, client):
        register(client)
        raw = token_from_mail(mail.outbox[0])
        record = VerificationToken.objects.get()
        assert record.token_hash != raw
        assert not VerificationToken.objects.filter(token_hash=raw).exists()
        ttl = record.expires_at - record.created_at
        assert abs(ttl - timedelta(hours=24)) < timedelta(seconds=5)

    def test_token_is_single_use(self, client):
        register(client)
        raw = token_from_mail(mail.outbox[0])
        assert client.post("email/verify/", {"token": raw}).status_code == 200
        reused = client.post("email/verify/", {"token": raw})
        assert reused.status_code == 400
        assert reused.json()["code"] == "invalid_token"

    def test_expired_token(self, client):
        register(client)
        VerificationToken.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
        response = client.post("email/verify/", {"token": token_from_mail(mail.outbox[0])})
        assert response.json()["code"] == "token_expired"

    def test_unknown_token(self, client):
        assert client.post("email/verify/", {"token": "nope"}).json()["code"] == "invalid_token"

    def test_reset_token_cannot_verify_email(self, client, user):
        client.post("password/forgot/", {"email": user.email})
        raw = token_from_mail(mail.outbox[0])
        assert client.post("email/verify/", {"token": raw}).json()["code"] == "invalid_token"

    def test_token_dies_when_email_changes(self, client):
        register(client)
        User.objects.filter(email="ali@example.com").update(email="new@example.com")
        response = client.post("email/verify/", {"token": token_from_mail(mail.outbox[0])})
        assert response.json()["code"] == "invalid_token"

    def test_resend_cooldown_then_new_token(self, client, make_client):
        access = register(client).json()["access"]
        authed = make_client().bearer(access)
        cooldown = authed.post("email/resend/")
        assert cooldown.status_code == 429
        assert cooldown.json()["code"] == "resend_cooldown"
        assert len(mail.outbox) == 1

        cache.clear()  # 60 soniya o'tdi
        assert authed.post("email/resend/").json() == {"ok": True}
        assert len(mail.outbox) == 2
        old, new = (token_from_mail(m) for m in mail.outbox)
        assert client.post("email/verify/", {"token": old}).json()["code"] == "invalid_token"
        assert client.post("email/verify/", {"token": new}).status_code == 200

    def test_resend_for_verified_user(self, make_client, client, user):
        access = login(client).json()["access"]
        response = make_client().bearer(access).post("email/resend/")
        assert response.json()["code"] == "already_verified"

    def test_resend_requires_auth(self, client):
        assert client.post("email/resend/").status_code == 401


class TestEmails:
    def test_language_follows_profile_locale(self, client):
        register(client, locale="ru")
        message = mail.outbox[0]
        assert message.subject == "maktab365: подтвердите email"
        assert "http://frontend.test/ru/email-tasdiqlash?token=" in message.body
        html, mimetype = message.alternatives[0]
        assert mimetype == "text/html"
        assert "Подтвердить email" in html

    def test_cyrillic_uzbek_gets_uzbek_text_and_own_path(self, client):
        register(client, locale="uz-Cyrl")
        message = mail.outbox[0]
        assert message.subject == "maktab365: emailingizni tasdiqlang"
        assert "/uz-Cyrl/email-tasdiqlash?token=" in message.body

    def test_reset_email_english(self, client):
        user = User.objects.create_user(email="en@example.com", password=PASSWORD)
        Profile.objects.create(user=user, locale="en")
        client.post("password/forgot/", {"email": "EN@example.com"})
        message = mail.outbox[0]
        assert message.subject == "maktab365: reset your password"
        assert "/en/parolni-tiklash?token=" in message.body


# --- parolni tiklash va almashtirish ---


class TestPasswordReset:
    def test_forgot_does_not_reveal_accounts(self, client, user):
        known = client.post("password/forgot/", {"email": user.email})
        unknown = client.post("password/forgot/", {"email": "hech-kim@example.com"})
        assert known.status_code == unknown.status_code == 200
        assert known.json() == unknown.json() == {"ok": True}
        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == [user.email]

    def test_forgot_invalid_email_format(self, client):
        assert client.post("password/forgot/", {"email": "x"}).status_code == 400

    def test_reset_flow(self, client, user):
        session = login(client).json()
        client.post("password/forgot/", {"email": user.email})
        raw = token_from_mail(mail.outbox[0])
        assert VerificationToken.objects.get().expires_at - timezone.now() <= timedelta(hours=1)

        response = client.post("password/reset/", {"token": raw, "password": NEW_PASSWORD})
        assert response.status_code == 200
        assert login(client).status_code == 401
        assert login(client, password=NEW_PASSWORD).status_code == 200
        # Barcha eski sessiyalar chiqariladi.
        assert client.post("refresh/", {"refresh": session["refresh"]}).status_code == 401
        assert "password_reset" in event_types(user)

        reused = client.post("password/reset/", {"token": raw, "password": "boshqa-parol-99"})
        assert reused.json()["code"] == "invalid_token"

    def test_weak_password_keeps_token_usable(self, client, user):
        client.post("password/forgot/", {"email": user.email})
        raw = token_from_mail(mail.outbox[0])
        weak = client.post("password/reset/", {"token": raw, "password": "123"})
        assert weak.status_code == 400
        assert "password_too_short" in weak.json()["details"]["password"]
        ok = client.post("password/reset/", {"token": raw, "password": NEW_PASSWORD})
        assert ok.status_code == 200

    def test_expired_reset_token(self, client, user):
        client.post("password/forgot/", {"email": user.email})
        VerificationToken.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
        response = client.post(
            "password/reset/",
            {"token": token_from_mail(mail.outbox[0]), "password": NEW_PASSWORD},
        )
        assert response.json()["code"] == "token_expired"

    def test_new_request_invalidates_previous_link(self, client, user):
        client.post("password/forgot/", {"email": user.email})
        client.post("password/forgot/", {"email": user.email})
        old, new = (token_from_mail(m) for m in mail.outbox)
        payload = {"password": NEW_PASSWORD}
        assert client.post("password/reset/", {"token": old, **payload}).status_code == 400
        assert client.post("password/reset/", {"token": new, **payload}).status_code == 200

    def test_reset_clears_lockout_and_verifies_email(self, client, settings):
        settings.AUTH_LOCKOUT_THRESHOLD = 1
        unverified = User.objects.create_user(email="u@example.com", password=PASSWORD)
        assert login(client, email="u@example.com", password="x").status_code == 429
        client.post("password/forgot/", {"email": "u@example.com"})
        raw = token_from_mail(mail.outbox[0])
        client.post("password/reset/", {"token": raw, "password": NEW_PASSWORD})
        assert login(client, email="u@example.com", password=NEW_PASSWORD).status_code == 200
        unverified.refresh_from_db()
        assert unverified.email_verified_at is not None

    def test_passwordless_account_can_set_password(self, client):
        User.objects.create_user(email="google@example.com")
        client.post("password/forgot/", {"email": "google@example.com"})
        raw = token_from_mail(mail.outbox[0])
        client.post("password/reset/", {"token": raw, "password": NEW_PASSWORD})
        assert login(client, email="google@example.com", password=NEW_PASSWORD).status_code == 200


class TestPasswordChange:
    def test_change_keeps_current_session_only(self, client, make_client, user):
        current = login(client).json()
        other = login(client).json()
        response = (
            make_client()
            .bearer(current["access"])
            .post(
                "password/change/",
                {
                    "current_password": PASSWORD,
                    "new_password": NEW_PASSWORD,
                    "refresh": current["refresh"],
                },
            )
        )
        assert response.status_code == 200
        assert client.post("refresh/", {"refresh": other["refresh"]}).status_code == 401
        assert client.post("refresh/", {"refresh": current["refresh"]}).status_code == 200
        assert login(client, password=NEW_PASSWORD).status_code == 200
        assert "password_changed" in event_types(user)

    def test_foreign_refresh_is_not_kept(self, client, make_client, user):
        stranger = User.objects.create_user(email="s@example.com", password=PASSWORD)
        stranger_refresh = auth_services.issue_tokens(stranger)["refresh"]
        current = login(client).json()
        make_client().bearer(current["access"]).post(
            "password/change/",
            {
                "current_password": PASSWORD,
                "new_password": NEW_PASSWORD,
                "refresh": stranger_refresh,
            },
        )
        assert client.post("refresh/", {"refresh": current["refresh"]}).status_code == 401
        assert client.post("refresh/", {"refresh": stranger_refresh}).status_code == 200

    def test_wrong_current_password(self, client, make_client, user):
        access = login(client).json()["access"]
        response = (
            make_client()
            .bearer(access)
            .post(
                "password/change/", {"current_password": "xato-parol", "new_password": NEW_PASSWORD}
            )
        )
        assert response.status_code == 400
        assert response.json()["details"] == {"current_password": ["invalid_password"]}
        user.refresh_from_db()
        assert user.check_password(PASSWORD)

    def test_weak_new_password(self, client, make_client, user):
        access = login(client).json()["access"]
        response = (
            make_client()
            .bearer(access)
            .post("password/change/", {"current_password": PASSWORD, "new_password": "qwerty"})
        )
        assert "new_password" in response.json()["details"]

    def test_requires_auth(self, client):
        assert client.post("password/change/", {"new_password": NEW_PASSWORD}).status_code == 401
