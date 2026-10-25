import time
from unittest import mock

import pytest
from django.core.cache import cache
from django.core.management import CommandError, call_command
from rest_framework.test import APIClient

from apps.accounts import telegram_login
from apps.accounts.models import Identity, Provider

pytestmark = pytest.mark.django_db

SECRET = "webhook-secret_123"
BOT = "darslik365_bot"
WEBHOOK = "/api/v1/auth/telegram/webhook/"


@pytest.fixture(autouse=True)
def _settings(settings):
    cache.clear()
    settings.TELEGRAM_BOT_TOKEN = "123456:TEST-BOT-TOKEN"
    settings.TELEGRAM_BOT_USERNAME = BOT
    settings.TELEGRAM_WEBHOOK_SECRET = SECRET
    settings.TELEGRAM_LOGIN_TTL_SECONDS = 300
    yield
    cache.clear()


@pytest.fixture
def api():
    return APIClient()


def start(api):
    response = api.post("/api/v1/auth/telegram/start/")
    assert response.status_code == 200
    return response.json()


def update(text, user_id=777, chat_type="private", **sender):
    return {
        "update_id": 1,
        "message": {
            "message_id": 5,
            "chat": {"id": user_id, "type": chat_type},
            "from": {"id": user_id, "is_bot": False, "first_name": "Vali", "username": "vali_k"}
            | sender,
            "text": text,
        },
    }


def webhook(api, body, secret=SECRET):
    headers = {"HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN": secret} if secret is not None else {}
    return api.post(WEBHOOK, body, format="json", **headers)


def status(api, token, nonce):
    headers = {"HTTP_X_TELEGRAM_NONCE": nonce} if nonce is not None else {}
    return api.get("/api/v1/auth/telegram/status/", {"token": token}, **headers)


def complete(api, token, nonce, **extra):
    return api.post(
        "/api/v1/auth/telegram/complete/",
        {"token": token, **extra},
        format="json",
        HTTP_X_TELEGRAM_NONCE=nonce,
    )


class TestStart:
    def test_returns_bot_link_and_sets_nonce_cookie(self, api):
        response = api.post("/api/v1/auth/telegram/start/")
        body = response.json()
        assert response.status_code == 200
        assert len(body["token"]) == 43
        assert body["bot_url"] == f"https://t.me/{BOT}?start={body['token']}"
        assert body["expires_in"] == 300
        cookie = response.cookies[telegram_login.NONCE_COOKIE]
        assert cookie.value == body["nonce"]
        assert cookie["httponly"] and cookie["samesite"] == "Lax"
        assert status(api, body["token"], body["nonce"]).json() == {"status": "pending"}

    def test_cache_holds_only_hashes(self, api):
        body = start(api)
        entry = cache.get(telegram_login._key(body["token"]))
        assert body["nonce"] not in str(entry)
        assert cache.get(f"auth:tglogin:{body['token']}") is None

    def test_tokens_are_unique(self, api):
        assert start(api)["token"] != start(api)["token"]

    def test_not_configured(self, api, settings):
        settings.TELEGRAM_WEBHOOK_SECRET = ""
        response = api.post("/api/v1/auth/telegram/start/")
        assert response.status_code == 503
        assert response.json()["code"] == "provider_not_configured"

    def test_rate_limited_per_ip(self, api, settings):
        settings.REST_FRAMEWORK = {
            **settings.REST_FRAMEWORK,
            "DEFAULT_THROTTLE_RATES": {
                **settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"],
                "telegram_start": "10/min",
            },
        }
        codes = [api.post("/api/v1/auth/telegram/start/").status_code for _ in range(11)]
        assert codes[:10] == [200] * 10
        assert codes[10] == 429


class TestWebhook:
    @pytest.mark.parametrize("secret", [None, "", "wrong"])
    def test_wrong_secret_is_forbidden(self, api, secret):
        body = start(api)
        response = webhook(api, update(f"/start {body['token']}"), secret=secret)
        assert response.status_code == 403
        assert status(api, body["token"], body["nonce"]).json() == {"status": "pending"}

    def test_forbidden_when_secret_not_configured(self, api, settings):
        settings.TELEGRAM_WEBHOOK_SECRET = ""
        assert webhook(api, update("/start x"), secret="").status_code == 403

    def test_start_confirms_pending_token(self, api):
        body = start(api)
        response = webhook(api, update(f"/start {body['token']}"))
        assert response.status_code == 200
        assert response.json() == {
            "method": "sendMessage",
            "chat_id": 777,
            "text": telegram_login.CONFIRMED_TEXT,
        }
        assert status(api, body["token"], body["nonce"]).json() == {"status": "confirmed"}

    def test_unknown_token_replies_expired(self, api):
        response = webhook(api, update("/start " + "a" * 43))
        assert response.json()["text"] == telegram_login.EXPIRED_TEXT

    def test_second_start_does_not_reconfirm(self, api):
        body = start(api)
        webhook(api, update(f"/start {body['token']}"))
        response = webhook(api, update(f"/start {body['token']}", user_id=999))
        assert response.json()["text"] == telegram_login.EXPIRED_TEXT
        entry = cache.get(telegram_login._key(body["token"]))
        assert entry["telegram"]["id"] == 777

    def test_plain_start_gets_hint(self, api):
        assert webhook(api, update("/start")).json()["text"] == telegram_login.HINT_TEXT

    @pytest.mark.parametrize(
        "body",
        [
            update("salom"),
            update("/start abc", chat_type="group"),
            update("/start abc", is_bot=True),
            {"update_id": 2, "edited_message": {}},
            {},
        ],
    )
    def test_other_updates_are_ignored(self, api, body):
        response = webhook(api, body)
        assert response.status_code == 200
        assert response.json() == {}


class TestStatus:
    def test_nonce_mismatch_is_forbidden(self, api):
        body = start(api)
        response = status(api, body["token"], "other-nonce")
        assert response.status_code == 403
        assert response.json()["code"] == "telegram_nonce_mismatch"

    def test_missing_nonce_is_forbidden(self):
        body = start(APIClient())  # nonce cookie boshqa klientda qoldi
        assert status(APIClient(), body["token"], None).status_code == 403

    def test_nonce_from_cookie(self, api):
        body = start(api)  # APIClient start bergan cookie'ni saqlaydi
        response = api.get("/api/v1/auth/telegram/status/", {"token": body["token"]})
        assert response.json() == {"status": "pending"}

    def test_unknown_or_malformed_token_is_expired(self, api):
        assert status(api, "b" * 43, "n").json() == {"status": "expired"}
        assert status(api, "../../etc", "n").json() == {"status": "expired"}

    def test_expired_after_ttl(self, api):
        body = start(api)
        with mock.patch("time.time", return_value=time.time() + 301):
            # locmem kesh muddati ham time.time() ga tayanadi.
            assert status(api, body["token"], body["nonce"]).json() == {"status": "expired"}

    def test_confirm_after_deadline_is_rejected(self, api):
        body = start(api)
        entry = cache.get(telegram_login._key(body["token"]))
        entry["expires_at"] = time.time() - 1
        cache.set(telegram_login._key(body["token"]), entry, 60)
        assert webhook(api, update(f"/start {body['token']}")).json()["text"] == (
            telegram_login.EXPIRED_TEXT
        )


class TestComplete:
    def confirmed(self, api, **sender):
        body = start(api)
        webhook(api, update(f"/start {body['token']}", **sender))
        return body

    def test_creates_user_with_telegram_identity(self, api):
        body = self.confirmed(api, last_name="Karimov")
        response = complete(api, body["token"], body["nonce"], locale="ru")
        data = response.json()
        assert response.status_code == 200
        assert set(data) == {"access", "refresh", "user", "is_new", "profile_completed"}
        assert data["is_new"] is True
        assert data["profile_completed"] is False
        assert data["user"]["email"] is None
        assert data["user"]["profile"]["display_name"] == "Vali Karimov"
        assert data["user"]["profile"]["locale"] == "ru"
        identity = Identity.objects.get(provider=Provider.TELEGRAM)
        assert identity.provider_uid == "777"
        assert response.cookies[telegram_login.NONCE_COOKIE].value == ""

    def test_token_is_single_use(self, api):
        body = self.confirmed(api)
        assert complete(api, body["token"], body["nonce"]).status_code == 200
        again = complete(api, body["token"], body["nonce"])
        assert again.status_code == 410
        assert again.json()["code"] == "telegram_login_expired"
        assert status(api, body["token"], body["nonce"]).json() == {"status": "expired"}

    def test_repeat_login_is_same_account(self, api):
        first = self.confirmed(api)
        user_id = complete(api, first["token"], first["nonce"]).json()["user"]["id"]
        second = self.confirmed(api)
        data = complete(api, second["token"], second["nonce"]).json()
        assert data["user"]["id"] == user_id
        assert data["is_new"] is False

    def test_same_identity_as_login_widget(self, api):
        """Widget (`auth/telegram/`) va bot bir xil `telegram` identity'ga olib keladi."""
        body = self.confirmed(api)
        complete(api, body["token"], body["nonce"])
        assert Identity.objects.filter(provider=Provider.TELEGRAM, provider_uid="777").count() == 1

    def test_pending_is_conflict(self, api):
        body = start(api)
        response = complete(api, body["token"], body["nonce"])
        assert response.status_code == 409
        assert response.json()["code"] == "telegram_login_pending"

    def test_nonce_mismatch_is_forbidden(self, api):
        body = self.confirmed(api)
        assert complete(api, body["token"], "stolen").status_code == 403
        # Begona urinish tokenni yoqmaydi: haqiqiy brauzer hali kira oladi.
        assert complete(api, body["token"], body["nonce"]).status_code == 200

    def test_profile_completed_after_onboarding(self, api):
        body = self.confirmed(api)
        access = complete(api, body["token"], body["nonce"]).json()["access"]
        api.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        response = api.post(
            "/api/v1/me/onboarding/",
            {"role": "student", "display_name": "Vali", "grade": 7},
            format="json",
        )
        assert response.status_code == 200
        api.credentials()
        again = self.confirmed(api)
        data = complete(api, again["token"], again["nonce"]).json()
        assert data["profile_completed"] is True
        assert data["user"]["profile"]["grade"] == 7

    @pytest.mark.parametrize("grade", [0, 12])
    def test_onboarding_rejects_grade_out_of_range(self, api, grade):
        body = self.confirmed(api)
        access = complete(api, body["token"], body["nonce"]).json()["access"]
        api.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        response = api.post(
            "/api/v1/me/onboarding/",
            {"role": "student", "display_name": "Vali", "grade": grade},
            format="json",
        )
        assert response.status_code == 400


class TestSetWebhookCommand:
    def test_calls_set_webhook_with_secret(self):
        with mock.patch("requests.post") as post:
            post.return_value.json.return_value = {"ok": True}
            call_command("set_telegram_webhook", "https://api.example.uz/")
        url = post.call_args.args[0]
        payload = post.call_args.kwargs["json"]
        assert url.endswith("/setWebhook")
        assert payload["url"] == "https://api.example.uz/api/v1/auth/telegram/webhook/"
        assert payload["secret_token"] == SECRET
        assert payload["allowed_updates"] == ["message"]

    def test_requires_https(self):
        with pytest.raises(CommandError):
            call_command("set_telegram_webhook", "http://api.example.uz")

    def test_requires_secret(self, settings):
        settings.TELEGRAM_WEBHOOK_SECRET = ""
        with pytest.raises(CommandError):
            call_command("set_telegram_webhook", "https://api.example.uz")

    def test_reports_telegram_error(self):
        with mock.patch("requests.post") as post:
            post.return_value.json.return_value = {"ok": False, "description": "bad url"}
            with pytest.raises(CommandError, match="bad url"):
                call_command("set_telegram_webhook", "https://api.example.uz")


class TestPollCommand:
    def updates(self, *results, ok=True, **extra):
        response = mock.Mock()
        response.json.return_value = {"ok": ok, "result": list(results), **extra}
        return response

    def test_confirms_start_and_replies(self, api):
        body = start(api)
        with mock.patch("requests.get") as get, mock.patch("requests.post") as post:
            get.return_value = self.updates(update(f"/start {body['token']}") | {"update_id": 41})
            call_command("telegram_poll", "--once")
        assert status(api, body["token"], body["nonce"]).json() == {"status": "confirmed"}
        url = post.call_args.args[0]
        assert url.endswith("/sendMessage")
        assert post.call_args.kwargs["json"] == {
            "chat_id": 777,
            "text": telegram_login.CONFIRMED_TEXT,
        }
        # --once: qayta ishga tushirishda update takrorlanmasin — offset tasdiqlanadi.
        assert get.call_args.kwargs["params"] == {"offset": 42, "timeout": 0}

    def test_ignored_update_sends_nothing(self):
        with mock.patch("requests.get") as get, mock.patch("requests.post") as post:
            get.return_value = self.updates(update("salom"))
            call_command("telegram_poll", "--once")
        post.assert_not_called()

    def test_webhook_conflict_is_reported(self):
        with mock.patch("requests.get") as get:
            get.return_value = self.updates(ok=False, error_code=409, description="Conflict")
            with pytest.raises(CommandError, match="409"):
                call_command("telegram_poll", "--once")

    def test_requires_configuration(self, settings):
        settings.TELEGRAM_WEBHOOK_SECRET = ""
        with pytest.raises(CommandError):
            call_command("telegram_poll", "--once")
