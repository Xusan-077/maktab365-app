import pytest
from django.urls import include, path
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.test import APIClient
from rest_framework.views import APIView

from apps.core import views
from apps.core.version import API_REVISION


class Payload(serializers.Serializer):
    name = serializers.CharField()


class ValidateView(APIView):
    authentication_classes: list = []
    permission_classes: list = []

    def post(self, request):
        Payload(data=request.data).is_valid(raise_exception=True)
        return Response({})


class BoomView(APIView):
    authentication_classes: list = []
    permission_classes: list = []

    def get(self, request):
        raise RuntimeError("boom")


# `TestErrorHandler` shu modulni urlconf sifatida ishlatadi.
urlpatterns = [
    path("api/v1/validate/", ValidateView.as_view()),
    path("api/v1/boom/", BoomView.as_view()),
    path("", include("config.urls")),
]


@pytest.fixture
def client():
    return APIClient(raise_request_exception=False)


@pytest.fixture(autouse=True)
def _redis_up(db, monkeypatch):
    monkeypatch.setattr(views, "check_redis", lambda: True)


def test_health_ok(client):
    response = client.get("/api/v1/health/")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["checks"] == {"database": "ok", "redis": "ok"}
    assert set(body["version"]) == {"commit", "api_revision", "environment"}


def test_health_reports_deployed_version(client, monkeypatch):
    monkeypatch.setenv("RAILWAY_GIT_COMMIT_SHA", "0123456789abcdef")
    monkeypatch.setenv("RAILWAY_ENVIRONMENT_NAME", "production")
    version = client.get("/api/v1/health/").json()["version"]
    assert version == {
        "commit": "0123456",
        "api_revision": API_REVISION,
        "environment": "production",
    }


def test_health_version_without_platform_env(client, monkeypatch):
    for name in (
        "RAILWAY_GIT_COMMIT_SHA",
        "GIT_COMMIT_SHA",
        "SOURCE_VERSION",
        "RAILWAY_ENVIRONMENT_NAME",
    ):
        monkeypatch.delenv(name, raising=False)
    version = client.get("/api/v1/health/").json()["version"]
    assert version["commit"] == "unknown" and version["environment"] == "local"


def test_health_degraded_when_redis_down(client, monkeypatch):
    monkeypatch.setattr(views, "check_redis", lambda: False)
    response = client.get("/api/v1/health/")
    assert response.status_code == 503
    assert response.json()["checks"] == {"database": "ok", "redis": "error"}


def test_request_id_generated_and_echoed(client):
    assert len(client.get("/api/v1/health/")["X-Request-ID"]) == 32
    echoed = client.get("/api/v1/health/", headers={"X-Request-ID": "abc-12345678"})
    assert echoed["X-Request-ID"] == "abc-12345678"


def test_invalid_request_id_replaced(client):
    response = client.get("/api/v1/health/", headers={"X-Request-ID": "bad id!"})
    assert response["X-Request-ID"] != "bad id!"


def test_not_found_is_flat_json(client):
    response = client.get("/api/v1/nope/")
    assert response.status_code == 404
    assert response.json() == {"code": "not_found", "message": "Not found."}


def test_schema_and_docs_available_when_enabled(client):
    assert client.get("/api/schema/").status_code == 200
    assert client.get("/api/docs/").status_code == 200


def test_cors_only_allows_configured_origin(client):
    ok = client.get("/api/v1/health/", headers={"Origin": "http://localhost:3000"})
    assert ok["Access-Control-Allow-Origin"] == "http://localhost:3000"
    bad = client.get("/api/v1/health/", headers={"Origin": "https://evil.example"})
    assert "Access-Control-Allow-Origin" not in bad


def test_cors_preflight_allows_request_id_header(client):
    response = client.options(
        "/api/v1/health/",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "x-request-id",
        },
    )
    assert response.status_code == 200
    assert "x-request-id" in response["Access-Control-Allow-Headers"]


@pytest.mark.urls("apps.core.tests.test_api")
class TestErrorHandler:
    def test_validation_error(self, client):
        response = client.post("/api/v1/validate/", {}, format="json")
        assert response.status_code == 400
        assert response.json() == {
            "code": "validation_error",
            "message": "Validation failed.",
            "details": {"name": ["This field is required."]},
        }

    def test_unhandled_exception(self, client):
        response = client.get("/api/v1/boom/")
        assert response.status_code == 500
        assert response.json() == {"code": "server_error", "message": "Internal server error."}
