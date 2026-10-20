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
    result = subprocess.run(
        [sys.executable, "-c", PROBE],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(result.stdout.strip().splitlines()[-1])


def test_prod_disables_dev_otp_and_eager_celery():
    assert probe_prod() == {"otp_dev_inbox": False, "eager": False, "routed": False}


def test_prod_ignores_env_that_enables_dev_conveniences():
    probed = probe_prod(CELERY_TASK_ALWAYS_EAGER="true", OTP_DEV_INBOX="true")
    assert probed == {"otp_dev_inbox": False, "eager": False, "routed": False}
