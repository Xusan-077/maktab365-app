import json
import os
import subprocess
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[3]

PROBE = """
import json, django
django.setup()
from django.conf import settings
from django.urls import Resolver404, resolve
try:
    resolve("/api/v1/dev/otp/")
    routed = True
except Resolver404:
    routed = False
print(json.dumps({
    "otp_dev_inbox": settings.OTP_DEV_INBOX,
    "eager": settings.CELERY_TASK_ALWAYS_EAGER,
    "routed": routed,
    "hosts": settings.ALLOWED_HOSTS,
    "whitenoise": "whitenoise.middleware.WhiteNoiseMiddleware" in settings.MIDDLEWARE,
    "static": settings.STORAGES["staticfiles"]["BACKEND"],
}))
"""


def probe_prod(**env_overrides) -> dict:
    env = {
        **os.environ,
        "DJANGO_SETTINGS_MODULE": "config.settings.prod",
        "SECRET_KEY": os.environ.get("SECRET_KEY", "prod-guard-test"),
        "ALLOWED_HOSTS": "testserver",
        **env_overrides,
    }
    result = subprocess.run(  # noqa: S603
        [sys.executable, "-c", PROBE],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(result.stdout.strip().splitlines()[-1])


def test_prod_disables_dev_otp_and_eager_celery():
    probed = probe_prod()
    assert (probed["otp_dev_inbox"], probed["eager"], probed["routed"]) == (False, False, False)


def test_prod_ignores_env_that_enables_dev_conveniences():
    probed = probe_prod(CELERY_TASK_ALWAYS_EAGER="true", OTP_DEV_INBOX="true")
    assert (probed["otp_dev_inbox"], probed["eager"], probed["routed"]) == (False, False, False)


def test_prod_allows_railway_healthcheck_host_and_serves_static():
    probed = probe_prod()
    assert probed["hosts"] == ["testserver", "healthcheck.railway.app"]
    assert probed["whitenoise"] is True
    assert probed["static"] == "whitenoise.storage.CompressedStaticFilesStorage"
