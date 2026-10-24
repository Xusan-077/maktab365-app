"""`STORAGES["covers"]`: env bo'lmasa `default` bilan bir xil, berilsa — alohida ommaviy bucket."""

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[3]

PROBE = """
import json, django
django.setup()
from django.conf import settings
print(json.dumps({"default": settings.STORAGES["default"], "covers": settings.STORAGES["covers"]}))
"""

COVERS_ENV = {
    "COVERS_BUCKET_NAME": "covers-bucket",
    "COVERS_S3_CUSTOM_DOMAIN": "cdn.example.test",
    "COVERS_ACCESS_KEY_ID": "covers-key",
    "COVERS_SECRET_ACCESS_KEY": "covers-secret",
}
COVERS_KEYS = tuple(COVERS_ENV) + ("COVERS_S3_ENDPOINT_URL",)


def run_probe(**overrides) -> subprocess.CompletedProcess:
    env = {k: v for k, v in os.environ.items() if k not in COVERS_KEYS}
    env.update(
        DJANGO_SETTINGS_MODULE="config.settings.prod",
        SECRET_KEY=os.environ.get("SECRET_KEY", "covers-settings-test"),
        ALLOWED_HOSTS="testserver",
        AWS_STORAGE_BUCKET_NAME="private-books",
        AWS_S3_ENDPOINT_URL="https://acc.r2.example.test",
        AWS_ACCESS_KEY_ID="private-key",
        AWS_SECRET_ACCESS_KEY="private-secret",
        **overrides,
    )
    return subprocess.run(  # noqa: S603
        [sys.executable, "-c", PROBE], cwd=BACKEND_DIR, env=env, capture_output=True, text=True
    )


def probe(**overrides) -> dict:
    result = run_probe(**overrides)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout.strip().splitlines()[-1])


def test_covers_falls_back_to_default_without_bucket_env():
    storages = probe()
    assert storages["covers"] == storages["default"]


def test_covers_is_separate_public_bucket_when_configured():
    storages = probe(**COVERS_ENV)

    assert storages["default"] == {"BACKEND": "storages.backends.s3.S3Storage"}
    options = storages["covers"]["OPTIONS"]
    assert options["bucket_name"] == "covers-bucket"
    assert options["custom_domain"] == "cdn.example.test"
    assert options["access_key"] == "covers-key" and options["secret_key"] == "covers-secret"
    assert options["querystring_auth"] is False
    # Shaxsiy endpoint o'zgaruvchisi berilmasa umumiy R2 endpoint ishlatiladi.
    assert options["endpoint_url"] == "https://acc.r2.example.test"


def test_covers_endpoint_can_be_overridden():
    storages = probe(**COVERS_ENV, COVERS_S3_ENDPOINT_URL="https://other.example.test")
    assert storages["covers"]["OPTIONS"]["endpoint_url"] == "https://other.example.test"


@pytest.mark.parametrize("missing", ["COVERS_S3_CUSTOM_DOMAIN", "COVERS_ACCESS_KEY_ID"])
def test_covers_bucket_requires_domain_and_own_keys(missing):
    env = {k: v for k, v in COVERS_ENV.items() if k != missing}
    result = run_probe(**env)
    assert result.returncode != 0 and missing in result.stderr
