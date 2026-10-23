import json

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken

from apps.accounts.auth_services import issue_tokens
from apps.accounts.models import AuditLog, Profile, Role, User
from apps.core.tests.passwords import OTHER_TEST_PASSWORD, TEST_PASSWORD

pytestmark = pytest.mark.django_db

URL = "/api/v1/admin/users/"


def make(email, role=Role.STUDENT, **extra):
    user = User.objects.create_user(email=email, password=TEST_PASSWORD, role=role, **extra)
    if role in (Role.EDITOR, Role.ADMIN):
        user.is_staff = True
        user.save(update_fields=["is_staff"])
    return user


def client_for(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture
def admin():
    return make("admin@example.com", Role.ADMIN)


@pytest.fixture
def api(admin):
    return client_for(admin)


def detail(user):
    return f"{URL}{user.pk}/"


class TestPermissions:
    @pytest.mark.parametrize("role", [Role.STUDENT, Role.TEACHER, Role.EDITOR])
    def test_only_admin(self, role):
        api = client_for(make(f"{role}@example.com", role))
        assert api.get(URL).status_code == 403
        assert api.post(URL, {}, format="json").status_code == 403

    def test_anonymous(self):
        assert APIClient().get(URL).status_code in (401, 403)


class TestList:
    def test_list_search_filters_and_name(self, api, admin):
        ali = make("ali@example.com", Role.TEACHER)
        Profile.objects.update_or_create(user=ali, defaults={"display_name": "Ali Valiyev"})
        make("vali@example.com")
        blocked = make("blocked@example.com", is_active=False)

        body = api.get(URL).json()
        assert body["count"] == 4
        row = next(r for r in body["results"] if r["email"] == "ali@example.com")
        assert row["display_name"] == "Ali Valiyev" and row["role"] == "teacher"
        assert "password" not in json.dumps(body)

        assert [r["email"] for r in api.get(URL, {"search": "Valiyev"}).json()["results"]] == [
            "ali@example.com"
        ]
        assert api.get(URL, {"role": "teacher"}).json()["count"] == 1
        assert [r["id"] for r in api.get(URL, {"status": "blocked"}).json()["results"]] == [
            str(blocked.pk)
        ]
        assert api.get(URL, {"status": "active"}).json()["count"] == 3

    def test_deleted_users_are_hidden(self, api):
        gone = make("gone@example.com")
        assert api.delete(detail(gone)).status_code == 204
        assert not any(r["id"] == str(gone.pk) for r in api.get(URL).json()["results"])


class TestCreate:
    def test_with_password(self, api):
        response = api.post(
            URL,
            {
                "email": " New@Example.com ",
                "display_name": "Yangi",
                "password": OTHER_TEST_PASSWORD,
                "role": "teacher",
            },
            format="json",
        )
        assert response.status_code == 201
        body = response.json()
        assert body["email"] == "new@example.com" and body["role"] == "teacher"
        assert body["temporary_password"] is None
        user = User.objects.get(email="new@example.com")
        assert user.check_password(OTHER_TEST_PASSWORD)
        assert not user.is_staff and user.profile.display_name == "Yangi"

    def test_temporary_password_is_returned_once(self, api):
        response = api.post(URL, {"email": "t@example.com", "role": "editor"}, format="json")
        assert response.status_code == 201
        temp = response.json()["temporary_password"]
        assert temp and User.objects.get(email="t@example.com").check_password(temp)
        assert User.objects.get(email="t@example.com").is_staff
        assert "temporary_password" not in json.dumps(api.get(URL).json())

    def test_admin_role_sets_flags(self, api):
        api.post(URL, {"email": "a2@example.com", "role": "admin"}, format="json")
        user = User.objects.get(email="a2@example.com")
        assert user.is_staff and user.is_superuser

    def test_duplicate_and_weak_password(self, api):
        make("dup@example.com")
        taken = api.post(URL, {"email": "DUP@example.com", "role": "student"}, format="json")
        assert taken.status_code == 400
        assert taken.json()["details"]["email"] == ["email_taken"]
        weak = api.post(
            URL,
            {"email": "w@example.com", "role": "student", "password": "12345678"},
            format="json",
        )
        assert weak.status_code == 400 and "password" in weak.json()["details"]
        assert not User.objects.filter(email="w@example.com").exists()

    def test_invalid_role(self, api):
        response = api.post(URL, {"email": "r@example.com", "role": "root"}, format="json")
        assert response.status_code == 400


class TestUpdate:
    def test_change_role_syncs_staff_flags(self, api):
        user = make("u@example.com")
        assert api.patch(detail(user), {"role": "editor"}, format="json").status_code == 200
        user.refresh_from_db()
        assert user.role == Role.EDITOR and user.is_staff and not user.is_superuser
        api.patch(detail(user), {"role": "student"}, format="json")
        user.refresh_from_db()
        assert user.role == Role.STUDENT and not user.is_staff

    def test_block_revokes_sessions_and_unblock(self, api):
        user = make("b@example.com")
        issue_tokens(user)
        assert api.patch(detail(user), {"is_active": False}, format="json").status_code == 200
        user.refresh_from_db()
        assert not user.is_active
        assert BlacklistedToken.objects.filter(token__user=user).exists()
        login = APIClient().post(
            "/api/v1/auth/login/", {"email": user.email, "password": TEST_PASSWORD}, format="json"
        )
        assert login.status_code == 401
        api.patch(detail(user), {"is_active": True}, format="json")
        user.refresh_from_db()
        assert user.is_active

    def test_display_name(self, api):
        user = make("n@example.com")
        response = api.patch(detail(user), {"display_name": " Nodir "}, format="json")
        assert response.json()["display_name"] == "Nodir"

    def test_unknown_user(self, api):
        assert (
            api.patch(f"{URL}00000000-0000-4000-8000-000000000000/", {}, format="json").status_code
            == 404
        )


class TestProtections:
    def test_env_admin_cannot_be_deleted_blocked_or_demoted(self, api):
        env = make("env@example.com", Role.ADMIN, is_env_admin=True)
        assert api.delete(detail(env)).json()["code"] == "env_admin_protected"
        blocked = api.patch(detail(env), {"is_active": False}, format="json")
        assert blocked.status_code == 403 and blocked.json()["code"] == "env_admin_protected"
        demoted = api.patch(detail(env), {"role": "teacher"}, format="json")
        assert demoted.json()["code"] == "env_admin_protected"
        env.refresh_from_db()
        assert env.role == Role.ADMIN and env.is_active and env.deleted_at is None

    def test_env_admin_can_still_be_renamed(self, api):
        env = make("env@example.com", Role.ADMIN, is_env_admin=True)
        assert api.patch(detail(env), {"display_name": "Boss"}, format="json").status_code == 200

    def test_admin_cannot_delete_block_or_demote_self(self, api, admin):
        make("second@example.com", Role.ADMIN)
        assert api.delete(detail(admin)).json()["code"] == "self_action_forbidden"
        assert (
            api.patch(detail(admin), {"is_active": False}, format="json").json()["code"]
            == "self_action_forbidden"
        )
        assert (
            api.patch(detail(admin), {"role": "student"}, format="json").json()["code"]
            == "self_action_forbidden"
        )
        admin.refresh_from_db()
        assert admin.role == Role.ADMIN and admin.is_active

    def test_last_admin_is_protected(self, admin):
        # So'rov paytida boshqa admin actorning rolini tushirgan bo'lsa, target oxirgi admin bo'ladi
        # (poyga): servis darajasida tekshiramiz.
        from apps.accounts import admin_user_services as services

        target = make("only@example.com", Role.ADMIN)
        User.objects.filter(pk=admin.pk).update(role=Role.EDITOR)
        admin.refresh_from_db()
        with pytest.raises(services.LastAdmin):
            services.delete_user(admin, target)
        assert User.objects.filter(pk=target.pk, deleted_at__isnull=True).exists()


class TestAudit:
    def test_every_change_is_logged_without_password(self, api):
        response = api.post(
            URL,
            {"email": "log@example.com", "password": OTHER_TEST_PASSWORD, "role": "student"},
            format="json",
        )
        user = User.objects.get(email="log@example.com")
        api.patch(detail(user), {"role": "teacher"}, format="json")
        api.patch(detail(user), {"is_active": False}, format="json")
        api.patch(detail(user), {"is_active": True}, format="json")
        api.delete(detail(user))

        actions = list(
            AuditLog.objects.filter(target_type="user", target_id=str(user.pk))
            .order_by("created_at")
            .values_list("action", flat=True)
        )
        assert actions == ["create", "role_change", "block", "unblock", "delete"]
        entry = AuditLog.objects.get(action="role_change", target_id=str(user.pk))
        assert entry.actor_label == "admin@example.com"
        assert entry.before["role"] == "student" and entry.after["role"] == "teacher"
        assert entry.target_label == "log@example.com"

        everything = json.dumps(
            list(AuditLog.objects.values("before", "after", "target_label", "actor_label"))
        )
        assert OTHER_TEST_PASSWORD not in everything
        assert OTHER_TEST_PASSWORD not in response.content.decode()
        temp = api.post(URL, {"email": "t2@example.com", "role": "student"}, format="json")
        assert temp.json()["temporary_password"] not in json.dumps(
            list(AuditLog.objects.values("before", "after"))
        )

    def test_rejected_actions_are_not_logged(self, api):
        env = make("env@example.com", Role.ADMIN, is_env_admin=True)
        api.delete(detail(env))
        assert not AuditLog.objects.filter(target_id=str(env.pk)).exists()
