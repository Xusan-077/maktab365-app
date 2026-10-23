import json
import logging

import pytest
from django.core.cache import cache
from rest_framework.test import APIClient
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken

from apps.accounts.models import AuditLog, AuthEvent, Role, User
from apps.core.tests.passwords import NEW_TEST_PASSWORD, OTHER_TEST_PASSWORD, TEST_PASSWORD

pytestmark = pytest.mark.django_db

ENV_EMAIL = "boss@example.com"
ENV_PASSWORD = OTHER_TEST_PASSWORD


@pytest.fixture(autouse=True)
def _env_admin(settings):
    settings.ADMIN_EMAIL = ENV_EMAIL
    settings.ADMIN_PASSWORD = ENV_PASSWORD
    cache.clear()
    yield
    cache.clear()


def login(email=ENV_EMAIL, password=ENV_PASSWORD, client=None):
    client = client or APIClient()
    return client.post("/api/v1/auth/login/", {"email": email, "password": password}, format="json")


def throttle_rates(settings, **rates):
    settings.REST_FRAMEWORK = {
        **settings.REST_FRAMEWORK,
        "DEFAULT_THROTTLE_RATES": {**settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"], **rates},
    }


class TestEnvLogin:
    def test_creates_admin_and_returns_tokens(self):
        assert not User.objects.filter(email=ENV_EMAIL).exists()
        response = login()
        assert response.status_code == 200
        body = response.json()
        assert body["access"] and body["refresh"]
        assert body["user"]["role"] == "admin"
        user = User.objects.get(email=ENV_EMAIL)
        assert user.role == Role.ADMIN
        assert user.is_env_admin and user.is_staff and user.is_active

    def test_email_is_case_and_space_insensitive(self):
        assert login(email="  Boss@Example.COM ").status_code == 200
        assert User.objects.filter(email=ENV_EMAIL).count() == 1

    def test_second_login_reuses_account(self):
        first = login().json()["user"]["id"]
        assert login().json()["user"]["id"] == first
        assert User.objects.filter(email=ENV_EMAIL).count() == 1

    def test_wrong_password_is_generic_error(self):
        login()
        wrong = login(password="x" + ENV_PASSWORD)
        unknown = login(email="nobody@example.com", password=ENV_PASSWORD)
        assert wrong.status_code == unknown.status_code == 401
        assert wrong.json() == unknown.json()
        assert wrong.json()["code"] == "invalid_credentials"

    def test_wrong_password_does_not_create_account(self):
        assert login(password="x" + ENV_PASSWORD).status_code == 401
        assert not User.objects.filter(email=ENV_EMAIL).exists()

    def test_disabled_without_env(self, settings):
        settings.ADMIN_PASSWORD = ""
        assert login().status_code == 401
        settings.ADMIN_PASSWORD = ENV_PASSWORD
        settings.ADMIN_EMAIL = ""
        assert login().status_code == 401
        assert not User.objects.filter(email=ENV_EMAIL).exists()

    def test_empty_env_does_not_accept_empty_password(self, settings):
        settings.ADMIN_EMAIL = ""
        settings.ADMIN_PASSWORD = ""
        assert login(email="", password="").status_code == 400

    def test_changed_env_password_updates_hash(self, settings):
        login()
        settings.ADMIN_PASSWORD = NEW_TEST_PASSWORD
        assert login(password=ENV_PASSWORD).status_code == 401
        assert login(password=NEW_TEST_PASSWORD).status_code == 200
        assert User.objects.get(email=ENV_EMAIL).check_password(NEW_TEST_PASSWORD)

    def test_db_password_is_not_accepted_for_env_email(self):
        user = login() and User.objects.get(email=ENV_EMAIL)
        user.set_password(TEST_PASSWORD)
        user.save()
        assert login(password=TEST_PASSWORD).status_code == 401

    def test_existing_user_is_promoted_and_sessions_revoked(self):
        student = User.objects.create_user(email=ENV_EMAIL, password=TEST_PASSWORD)
        old = login(password=TEST_PASSWORD)  # env paroli emas — kirmaydi
        assert old.status_code == 401
        from apps.accounts.auth_services import issue_tokens

        issue_tokens(student)
        assert login().status_code == 200
        student.refresh_from_db()
        assert student.role == Role.ADMIN and student.is_env_admin
        assert BlacklistedToken.objects.filter(token__user=student).exists()

    def test_only_one_env_admin(self, settings):
        login()
        settings.ADMIN_EMAIL = "second@example.com"
        assert login(email="second@example.com").status_code == 200
        assert User.objects.filter(is_env_admin=True).count() == 1
        assert not User.objects.get(email=ENV_EMAIL).is_env_admin

    def test_registration_with_env_email_is_refused(self):
        response = APIClient().post(
            "/api/v1/auth/register/",
            {"email": ENV_EMAIL, "password": TEST_PASSWORD},
            format="json",
        )
        assert response.status_code == 400
        assert not User.objects.filter(email=ENV_EMAIL).exists()


class TestEnvLoginLimits:
    def test_lockout_applies(self, settings):
        settings.AUTH_LOCKOUT_THRESHOLD = 2
        assert login(password="x-wrong-1").status_code == 401
        locked = login(password="x-wrong-2")
        assert locked.status_code == 429 and locked.json()["code"] == "login_locked"
        # To'g'ri parol ham bloklangan paytda o'tmaydi.
        assert login().json()["code"] == "login_locked"

    def test_ip_throttle_applies(self, settings):
        throttle_rates(settings, auth="3/min")
        statuses = [login(password=f"x-wrong-{i}").status_code for i in range(4)]
        assert statuses == [401, 401, 401, 429]

    def test_email_throttle_applies(self, settings):
        throttle_rates(settings, auth_email="2/min")
        statuses = [login(password=f"x-wrong-{i}").status_code for i in range(3)]
        assert statuses == [401, 401, 429]


class TestNoPasswordLeak:
    def test_password_not_in_logs_audit_or_response(self, caplog):
        caplog.set_level(logging.DEBUG)
        wrong = "wrong-" + ENV_PASSWORD
        responses = [login(password=wrong), login()]
        blobs = [r.content.decode() for r in responses]
        assert ENV_PASSWORD not in blobs[1] and wrong not in blobs[0]
        assert ENV_PASSWORD not in caplog.text and wrong not in caplog.text
        stored = json.dumps(
            [
                [event.meta for event in AuthEvent.objects.all()],
                [(log.before, log.after, log.target_label) for log in AuditLog.objects.all()],
            ]
        )
        assert ENV_PASSWORD not in stored and wrong not in stored


class TestAdminCannotUseLearnerApi:
    def test_admin_gets_403_on_learner_endpoints(self):
        access = login().json()["access"]
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        assert client.get("/api/v1/me/library/").status_code == 403
        assert client.get("/api/v1/me/goals/").status_code == 403
        assert client.get("/api/v1/me/pdf-bookmarks/").status_code == 403
        assert client.get("/api/v1/me/").status_code == 200

    def test_student_still_allowed(self):
        student = User.objects.create_user(email="s@example.com", password=TEST_PASSWORD)
        client = APIClient()
        client.force_authenticate(student)
        assert client.get("/api/v1/me/library/").status_code == 200
