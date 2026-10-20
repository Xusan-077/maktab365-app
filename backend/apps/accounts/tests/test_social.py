import time
from datetime import timedelta
from unittest import mock

import pytest
from django.core import mail
from django.core.cache import cache
from django.utils import timezone
from google.auth.exceptions import GoogleAuthError

from apps.accounts.models import AuthEvent, Identity, OtpChallenge, User
from apps.accounts.providers.sms import EskizSmsSender
from apps.accounts.providers.telegram import compute_hash
from apps.accounts.tests.test_auth import (
    NEW_PASSWORD,
    PASSWORD,
    Client,
    event_types,
    login,
    register,
)

pytestmark = pytest.mark.django_db

BOT_TOKEN = "123456:TEST-BOT-TOKEN"
GOOGLE_CLIENT = "client-id.apps.googleusercontent.com"
VERIFY = "apps.accounts.providers.google.id_token.verify_oauth2_token"


@pytest.fixture(autouse=True)
def _provider_settings(settings):
    cache.clear()
    settings.GOOGLE_CLIENT_ID = GOOGLE_CLIENT
    settings.TELEGRAM_BOT_TOKEN = BOT_TOKEN
    yield
    cache.clear()


class Api(Client):
    """`/api/v1/me/*` uchun qo'shimcha yordamchilar."""

    def post_me(self, path, data=None):
        with self.capture(execute=True):
            return self.api.post(f"/api/v1/me/{path}", data or {}, format="json")

    def delete_me(self, path):
        return self.api.delete(f"/api/v1/me/{path}")


@pytest.fixture
def client(django_capture_on_commit_callbacks):
    return Api(django_capture_on_commit_callbacks)


@pytest.fixture
def make_client(django_capture_on_commit_callbacks):
    return lambda: Api(django_capture_on_commit_callbacks)


def claims(sub="g-1", email="ali@example.com", verified=True, **extra):
    return {
        "sub": sub,
        "email": email,
        "email_verified": verified,
        "name": "Ali Valiyev",
        "picture": "https://lh3.example.com/a.png",
        **extra,
    }


def google(client, sub="g-1", email="ali@example.com", verified=True, **extra):
    with mock.patch(VERIFY, return_value=claims(sub, email, verified)) as verify:
        response = client.post("google/", {"id_token": "fake.jwt", **extra})
    return response, verify


def telegram_payload(user_id=777, auth_date=None, **extra):
    fields = {
        "id": user_id,
        "first_name": "Vali",
        "last_name": "Karimov",
        "username": "vali_k",
        "photo_url": "https://t.me/i/userpic/320/vali.jpg",
        "auth_date": int(time.time()) if auth_date is None else auth_date,
        **extra,
    }
    return {**fields, "hash": compute_hash(fields, BOT_TOKEN)}


def telegram(client, **kwargs):
    extra = {"locale": kwargs.pop("locale")} if "locale" in kwargs else {}
    payload = telegram_payload(**kwargs)
    return client.post("telegram/", {**payload, **extra}), payload


def otp_code() -> str:
    body = mail.outbox[-1].body
    return next(word for word in body.split() if word.isdigit() and len(word) == 6)


def request_otp(client, email="ali@example.com", **extra):
    return client.post("otp/request/", {"email": email, **extra})


def verify_otp(client, code, email="ali@example.com", **extra):
    return client.post("otp/verify/", {"email": email, "code": code, **extra})


def bearer(make_client, session):
    return make_client().bearer(session["access"])


def verified_user(email="ali@example.com", password=PASSWORD):
    user = User.objects.create_user(email=email, password=password)
    user.email_verified_at = timezone.now()
    user.save()
    return user


def assert_session(response, *, is_new):
    body = response.json()
    assert response.status_code == 200
    assert set(body) == {"access", "refresh", "user", "is_new"}
    assert body["is_new"] is is_new
    return body


# --- Google ---


class TestGoogle:
    def test_new_account(self, client):
        response, verify = google(client, locale="ru")
        body = assert_session(response, is_new=True)
        user = User.objects.get(email="ali@example.com")
        assert user.email_verified_at is not None
        assert not user.has_usable_password()
        assert user.profile.display_name == "Ali Valiyev"
        assert user.profile.locale == "ru"
        assert body["user"]["email_verified"] is True
        identity = user.identities.get()
        assert (identity.provider, identity.provider_uid, identity.verified) == (
            "google",
            "g-1",
            True,
        )
        assert verify.call_args.args[2] == GOOGLE_CLIENT  # aud tekshiriladi
        assert {"registered", "login"} <= set(event_types(user))

    def test_repeat_login_is_same_account(self, client):
        google(client)
        response, _ = google(client)
        assert_session(response, is_new=False)
        assert User.objects.count() == 1

    def test_links_to_existing_verified_account(self, client):
        existing = verified_user()
        response, _ = google(client)
        assert_session(response, is_new=False)
        assert User.objects.count() == 1
        assert set(existing.identities.values_list("provider", flat=True)) == {"google"}
        # Parol bilan kirish buzilmaydi.
        assert login(client).status_code == 200
        assert "identity_linked" in event_types(existing)

    def test_unverified_account_is_not_linked(self, client):
        victim = User.objects.create_user(email="ali@example.com", password=PASSWORD)
        response, _ = google(client)
        assert response.status_code == 409
        assert response.json()["code"] == "email_unverified_account"
        assert not victim.identities.exists()
        assert User.objects.count() == 1

    def test_unverified_google_email_rejected(self, client):
        response, _ = google(client, verified=False)
        assert response.status_code == 401
        assert response.json()["code"] == "provider_email_unverified"
        assert not User.objects.exists()

    @pytest.mark.parametrize(
        ("error", "code"),
        [
            (ValueError("Wrong number of segments"), "provider_auth_invalid"),
            (GoogleAuthError("Token used too late"), "provider_auth_invalid"),
            (GoogleAuthError("Token expired"), "provider_auth_expired"),
        ],
    )
    def test_invalid_token(self, client, error, code):
        with mock.patch(VERIFY, side_effect=error):
            response = client.post("google/", {"id_token": "bad"})
        assert response.status_code == 401
        assert response.json()["code"] == code

    def test_not_configured(self, client, settings):
        settings.GOOGLE_CLIENT_ID = ""
        response, _ = google(client)
        assert response.status_code == 503
        assert response.json()["code"] == "provider_not_configured"

    def test_inactive_user(self, client):
        google(client)
        User.objects.update(is_active=False)
        response, _ = google(client)
        assert response.status_code == 401


# --- Telegram ---


class TestTelegram:
    def test_new_account_without_email(self, client):
        response, _ = telegram(client, locale="en")
        body = assert_session(response, is_new=True)
        user = User.objects.get()
        assert user.email is None
        assert user.email_verified_at is None
        assert user.profile.display_name == "Vali Karimov"
        assert user.profile.locale == "en"
        assert body["user"]["email"] is None
        assert user.identities.get().provider_uid == "777"

    def test_repeat_login_is_same_account(self, client):
        telegram(client, auth_date=int(time.time()) - 2)
        response, _ = telegram(client)
        assert_session(response, is_new=False)
        assert User.objects.count() == 1

    def test_tampered_field_is_rejected(self, client):
        payload = telegram_payload()
        response = client.post("telegram/", {**payload, "id": 778})
        assert response.status_code == 401
        assert response.json()["code"] == "provider_auth_invalid"
        assert not User.objects.exists()

    def test_wrong_hash(self, client):
        payload = telegram_payload()
        response = client.post("telegram/", {**payload, "hash": "0" * 64})
        assert response.json()["code"] == "provider_auth_invalid"

    def test_signed_with_other_bot_token(self, client):
        fields = {"id": 1, "first_name": "X", "auth_date": int(time.time())}
        forged = {**fields, "hash": compute_hash(fields, "999:OTHER")}
        assert client.post("telegram/", forged).status_code == 401

    def test_malformed_hash(self, client):
        payload = telegram_payload()
        assert client.post("telegram/", {**payload, "hash": "zz"}).status_code == 400

    def test_old_auth_date(self, client, settings):
        old = int(time.time()) - settings.TELEGRAM_AUTH_MAX_AGE_SECONDS - 5
        response, _ = telegram(client, auth_date=old)
        assert response.status_code == 401
        assert response.json()["code"] == "provider_auth_expired"
        assert not User.objects.exists()

    def test_future_auth_date(self, client):
        response, _ = telegram(client, auth_date=int(time.time()) + 3600)
        assert response.json()["code"] == "provider_auth_expired"

    def test_replay_is_rejected(self, client):
        payload = telegram_payload()
        assert client.post("telegram/", payload).status_code == 200
        replay = client.post("telegram/", payload)
        assert replay.status_code == 401
        assert replay.json()["code"] == "provider_auth_replayed"

    def test_optional_fields_omitted(self, client):
        fields = {"id": 5, "first_name": "Sora", "auth_date": int(time.time())}
        payload = {**fields, "hash": compute_hash(fields, BOT_TOKEN)}
        assert client.post("telegram/", payload).status_code == 200

    def test_not_configured(self, client, settings):
        settings.TELEGRAM_BOT_TOKEN = ""
        response, _ = telegram(client)
        assert response.status_code == 503

    def test_never_links_by_email(self, client):
        verified_user()
        telegram(client)
        assert User.objects.count() == 2


# --- email OTP ---


class TestOtp:
    def test_request_and_verify_new_account(self, client):
        assert request_otp(client, locale="en").json() == {"ok": True}
        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == ["ali@example.com"]
        assert "sign-in code" in mail.outbox[0].subject
        response = verify_otp(client, otp_code(), locale="ru")
        body = assert_session(response, is_new=True)
        user = User.objects.get(email="ali@example.com")
        assert user.email_verified_at is not None
        assert body["user"]["email_verified"] is True
        assert user.identities.get().provider == "email_otp"

    def test_code_is_six_digits_hashed_and_expires(self, client, settings):
        request_otp(client)
        code = otp_code()
        challenge = OtpChallenge.objects.get()
        assert len(code) == 6
        assert code not in challenge.code_hash
        assert challenge.expires_at - challenge.created_at <= timedelta(minutes=10, seconds=5)
        assert challenge.expires_at - challenge.created_at >= timedelta(minutes=9, seconds=55)

    def test_request_response_does_not_reveal_accounts(self, client):
        verified_user()
        known = request_otp(client)
        unknown = request_otp(client, email="hech-kim@example.com")
        assert known.status_code == unknown.status_code == 200
        assert known.json() == unknown.json()

    def test_code_is_single_use(self, client):
        request_otp(client)
        code = otp_code()
        assert verify_otp(client, code).status_code == 200
        again = verify_otp(client, code)
        assert again.status_code == 400
        assert again.json()["code"] == "invalid_code"

    def test_wrong_code(self, client):
        request_otp(client)
        wrong = "000000" if otp_code() != "000000" else "111111"
        response = verify_otp(client, wrong)
        assert response.status_code == 400
        assert response.json()["code"] == "invalid_code"
        assert not User.objects.exists()

    def test_attempt_limit_locks_even_the_right_code(self, client, settings):
        request_otp(client)
        code = otp_code()
        wrong = "000000" if code != "000000" else "111111"
        statuses = [verify_otp(client, wrong).status_code for _ in range(settings.OTP_MAX_ATTEMPTS)]
        assert statuses == [400] * (settings.OTP_MAX_ATTEMPTS - 1) + [429]
        locked = verify_otp(client, code)
        assert locked.status_code == 429
        assert locked.json()["code"] == "otp_locked"
        assert not User.objects.exists()

    def test_new_request_replaces_old_code_and_resets_attempts(self, client):
        request_otp(client)
        old = otp_code()
        wrong = "000000" if old != "000000" else "111111"
        verify_otp(client, wrong)
        cache.clear()  # cooldown o'tdi
        request_otp(client)
        new = otp_code()
        assert OtpChallenge.objects.filter(consumed_at__isnull=True).count() == 1
        if new != old:
            assert verify_otp(client, old).status_code == 400
        assert verify_otp(client, new).status_code == 200

    def test_expired_code(self, client):
        request_otp(client)
        OtpChallenge.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
        response = verify_otp(client, otp_code())
        assert response.status_code == 400
        assert response.json()["code"] == "code_expired"

    def test_no_challenge(self, client):
        assert verify_otp(client, "123456").json()["code"] == "invalid_code"

    def test_code_is_bound_to_email(self, client):
        request_otp(client)
        code = otp_code()
        response = verify_otp(client, code, email="boshqa@example.com")
        assert response.json()["code"] == "invalid_code"

    def test_resend_cooldown(self, client, settings):
        assert request_otp(client).status_code == 200
        again = request_otp(client)
        assert again.status_code == 429
        assert again.json()["code"] == "otp_cooldown"
        assert len(mail.outbox) == 1
        assert request_otp(client, email="vali@example.com").status_code == 200
        cache.clear()  # 60 soniya o'tdi
        assert request_otp(client).status_code == 200
        assert len(mail.outbox) == 3

    def test_malformed_code(self, client):
        for code in ("12345", "1234567", "abcdef"):
            assert verify_otp(client, code).status_code == 400

    def test_email_throttle(self, client, settings):
        settings.REST_FRAMEWORK = {
            **settings.REST_FRAMEWORK,
            "DEFAULT_THROTTLE_RATES": {
                **settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"],
                "auth_email": "3/min",
            },
        }
        statuses = [
            verify_otp(client, "123456", REMOTE_ADDR=f"10.2.0.{i}").status_code for i in range(4)
        ]
        assert statuses[-1] == 429

    def test_existing_verified_account_logs_in(self, client):
        existing = verified_user()
        request_otp(client)
        response = verify_otp(client, otp_code())
        assert_session(response, is_new=False)
        assert User.objects.count() == 1
        assert response.json()["user"]["id"] == str(existing.pk)
        assert login(client).status_code == 200  # parol saqlanadi

    def test_unverified_account_is_reclaimed(self, client, make_client):
        # Kimdir birovning emailiga oldindan akkaunt ochgan va o'z parolini qo'ygan.
        squatter = register(client)
        stale = squatter.json()
        mail.outbox.clear()
        request_otp(client)
        response = verify_otp(client, otp_code())
        assert_session(response, is_new=False)
        user = User.objects.get(email="ali@example.com")
        assert user.email_verified_at is not None
        assert not user.has_usable_password()
        assert login(client).status_code == 401
        assert client.post("refresh/", {"refresh": stale["refresh"]}).status_code == 401
        assert set(user.identities.values_list("provider", flat=True)) == {"email_otp"}


# --- ulangan kirish usullari ---


def sign_in_google(client, **kwargs):
    response, _ = google(client, **kwargs)
    return response.json()


class TestIdentities:
    def test_list(self, client, make_client):
        verified_user()
        session = login(client).json()
        listing = bearer(make_client, session).get("/api/v1/me/identities/").json()
        assert listing["has_password"] is True
        assert listing["identities"] == []

    def test_list_for_registered_user_includes_password(self, client, make_client):
        session = register(client).json()
        listing = bearer(make_client, session).get("/api/v1/me/identities/").json()
        assert [i["provider"] for i in listing["identities"]] == ["password"]
        assert set(listing["identities"][0]) == {
            "id",
            "provider",
            "email",
            "verified",
            "created_at",
        }

    def test_requires_auth(self, client):
        assert client.get("/api/v1/me/identities/").status_code == 401

    def test_link_google(self, client, make_client):
        session = register(client).json()
        authed = bearer(make_client, session)
        with mock.patch(VERIFY, return_value=claims(sub="g-9", email="boshqa@example.com")):
            response = authed.post_me("identities/google/", {"id_token": "x"})
        assert response.status_code == 200
        assert response.json()["provider"] == "google"
        listing = authed.get("/api/v1/me/identities/").json()
        assert {i["provider"] for i in listing["identities"]} == {"password", "google"}
        # Google endi ham shu akkauntga kiradi.
        again, _ = google(client, sub="g-9", email="boshqa@example.com")
        assert again.json()["user"]["id"] == session["user"]["id"]
        assert User.objects.count() == 1

    def test_link_is_idempotent(self, client, make_client):
        session = register(client).json()
        authed = bearer(make_client, session)
        for _ in range(2):
            with mock.patch(VERIFY, return_value=claims(sub="g-9", email="boshqa@example.com")):
                assert authed.post_me("identities/google/", {"id_token": "x"}).status_code == 200
        assert Identity.objects.filter(provider="google").count() == 1

    def test_identity_of_another_account_conflicts(self, client, make_client):
        sign_in_google(client, sub="g-9", email="boshqa@example.com")
        session = register(client, email="vali@example.com").json()
        with mock.patch(VERIFY, return_value=claims(sub="g-9", email="boshqa@example.com")):
            response = bearer(make_client, session).post_me("identities/google/", {"id_token": "x"})
        assert response.status_code == 409
        assert response.json()["code"] == "identity_taken"

    def test_second_account_of_same_provider_conflicts(self, client, make_client):
        session = register(client).json()
        authed = bearer(make_client, session)
        with mock.patch(VERIFY, return_value=claims(sub="g-1", email="x@example.com")):
            authed.post_me("identities/google/", {"id_token": "x"})
        with mock.patch(VERIFY, return_value=claims(sub="g-2", email="y@example.com")):
            response = authed.post_me("identities/google/", {"id_token": "x"})
        assert response.json()["code"] == "provider_already_linked"

    def test_link_telegram_and_google_fills_missing_email(self, client, make_client):
        tg, _ = telegram(client)
        session = tg.json()
        authed = bearer(make_client, session)
        with mock.patch(VERIFY, return_value=claims(sub="g-3", email="yangi@example.com")):
            assert authed.post_me("identities/google/", {"id_token": "x"}).status_code == 200
        user = User.objects.get(pk=session["user"]["id"])
        assert user.email == "yangi@example.com"
        assert user.email_verified_at is not None

    def test_link_telegram(self, client, make_client):
        session = register(client).json()
        authed = bearer(make_client, session)
        response = authed.post_me("identities/telegram/", telegram_payload(user_id=4242))
        assert response.status_code == 200
        login_again, _ = telegram(client, user_id=4242, auth_date=int(time.time()) + 1)
        assert login_again.json()["user"]["id"] == session["user"]["id"]

    def test_link_otp_for_email_of_another_account(self, client, make_client):
        verified_user(email="vali@example.com")
        session = register(client).json()
        request_otp(client, email="vali@example.com")
        response = bearer(make_client, session).post_me(
            "identities/email_otp/", {"email": "vali@example.com", "code": otp_code()}
        )
        assert response.status_code == 409
        assert response.json()["code"] == "email_in_use"

    def test_unknown_provider(self, client, make_client):
        session = register(client).json()
        assert bearer(make_client, session).post_me("identities/vk/", {}).status_code == 404

    def test_unlink(self, client, make_client):
        session = register(client).json()
        authed = bearer(make_client, session)
        with mock.patch(VERIFY, return_value=claims(sub="g-1", email="x@example.com")):
            linked = authed.post_me("identities/google/", {"id_token": "x"}).json()
        response = authed.delete_me(f"identities/{linked['id']}/")
        assert response.status_code == 204
        assert not Identity.objects.filter(provider="google").exists()
        assert "identity_unlinked" in event_types(User.objects.get(pk=session["user"]["id"]))

    def test_last_identity_cannot_be_removed(self, client, make_client):
        session = sign_in_google(client)
        authed = bearer(make_client, session)
        only = Identity.objects.get()
        response = authed.delete_me(f"identities/{only.pk}/")
        assert response.status_code == 409
        assert response.json()["code"] == "last_identity"
        assert Identity.objects.filter(pk=only.pk).exists()

    def test_cannot_remove_foreign_identity(self, client, make_client):
        sign_in_google(client, sub="g-1", email="a@example.com")
        foreign = Identity.objects.get()
        session = register(client, email="vali@example.com").json()
        response = bearer(make_client, session).delete_me(f"identities/{foreign.pk}/")
        assert response.status_code == 404
        assert Identity.objects.filter(pk=foreign.pk).exists()

    def test_removing_password_identity_disables_password(self, client, make_client):
        session = register(client).json()
        authed = bearer(make_client, session)
        with mock.patch(VERIFY, return_value=claims(sub="g-1", email="ali@example.com")):
            authed.post_me("identities/google/", {"id_token": "x"})
        password_identity = Identity.objects.get(provider="password")
        assert authed.delete_me(f"identities/{password_identity.pk}/").status_code == 204
        assert login(client).status_code == 401
        listing = authed.get("/api/v1/me/identities/").json()
        assert listing["has_password"] is False

    def test_unlink_requires_auth(self, client):
        assert (
            client.delete_me("identities/00000000-0000-0000-0000-000000000000/").status_code == 401
        )


class TestPasswordSet:
    def test_passwordless_account_sets_password(self, client, make_client):
        session = sign_in_google(client)
        authed = bearer(make_client, session)
        assert authed.post_me("password/set/", {"new_password": NEW_PASSWORD}).json() == {
            "ok": True
        }
        assert login(client, password=NEW_PASSWORD).status_code == 200
        listing = authed.get("/api/v1/me/identities/").json()
        assert listing["has_password"] is True
        assert {i["provider"] for i in listing["identities"]} == {"google", "password"}
        assert "password_set" in event_types(User.objects.get())

    def test_account_with_password_cannot_use_set(self, client, make_client):
        session = register(client).json()
        response = bearer(make_client, session).post_me(
            "password/set/", {"new_password": NEW_PASSWORD}
        )
        assert response.status_code == 400
        assert response.json()["code"] == "password_already_set"

    def test_weak_password(self, client, make_client):
        session = sign_in_google(client)
        response = bearer(make_client, session).post_me("password/set/", {"new_password": "123"})
        assert response.status_code == 400
        assert "password_too_short" in response.json()["details"]["new_password"]

    def test_account_without_email_cannot_set_password(self, client, make_client):
        tg, _ = telegram(client)
        response = bearer(make_client, tg.json()).post_me(
            "password/set/", {"new_password": NEW_PASSWORD}
        )
        assert response.json()["code"] == "no_email"

    def test_requires_auth(self, client):
        assert client.post_me("password/set/", {"new_password": NEW_PASSWORD}).status_code == 401


# --- umumiy ---


class TestSessionShape:
    def test_all_methods_return_the_same_shape(self, client):
        google_body = sign_in_google(client)
        tg_body = telegram(client)[0].json()
        request_otp(client, email="otp@example.com")
        otp_body = verify_otp(client, otp_code(), email="otp@example.com").json()
        password_body = register(client, email="parol@example.com").json()
        for body in (google_body, tg_body, otp_body, password_body):
            assert set(body) == {"access", "refresh", "user", "is_new"}
            assert set(body["user"]) >= {"id", "email", "email_verified", "role", "profile"}

    def test_refresh_works_for_social_sessions(self, client):
        body = sign_in_google(client)
        assert client.post("refresh/", {"refresh": body["refresh"]}).status_code == 200

    def test_sms_interface_is_a_stub(self):
        with pytest.raises(NotImplementedError):
            EskizSmsSender().send("+998901234567", "kod")

    def test_events_hold_no_secrets(self, client):
        payload = telegram_payload()
        client.post("telegram/", payload)
        request_otp(client)
        code = otp_code()
        verify_otp(client, code)
        dump = " ".join(str(e.meta) + e.user_agent for e in AuthEvent.objects.all())
        assert payload["hash"] not in dump
        assert code not in dump
