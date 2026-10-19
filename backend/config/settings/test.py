import os

import environ

# backend/.env avval o'qiladi (host portlari mashinaga qarab farq qiladi), keyin default'lar.
environ.Env.read_env(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")
# Standart: docker-compose dagi postgres (`make test` uni o'zi ko'taradi). SQLite fallback yo'q.
os.environ.setdefault("DATABASE_URL", "postgres://maktab365:maktab365@localhost:5432/maktab365")

from .base import *  # noqa: E402, F403

DEBUG = False
LANGUAGE_CODE = "en"
ALLOWED_HOSTS = ["testserver", "localhost"]
ENABLE_API_DOCS = True

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
CELERY_TASK_ALWAYS_EAGER = True
SENTRY_DSN = ""
REST_FRAMEWORK = {  # noqa: F405
    **REST_FRAMEWORK,  # noqa: F405
    "DEFAULT_THROTTLE_RATES": {"anon": "1000/min", "user": "1000/min", "auth": "1000/min"},
}
