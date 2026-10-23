from .base import *  # noqa: F403
from .base import env

DEBUG = False

# Railway health-check so'rovlari `Host: healthcheck.railway.app` bilan keladi.
ALLOWED_HOSTS = [*ALLOWED_HOSTS, "healthcheck.railway.app"]  # noqa: F405

# Django `/admin/` statik fayllari (collectstatic image ichida): WhiteNoise gunicorn dan beradi.
MIDDLEWARE = [  # noqa: F405
    MIDDLEWARE[0],  # noqa: F405
    "whitenoise.middleware.WhiteNoiseMiddleware",
    *MIDDLEWARE[1:],  # noqa: F405
]
STORAGES = {  # noqa: F405
    **STORAGES,  # noqa: F405
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
}
ENABLE_API_DOCS = False
# Dev/e2e qulayliklari prod'da env orqali ham yoqilmasin.
OTP_DEV_INBOX = False
CELERY_TASK_ALWAYS_EAGER = False
# Draft kontentni ochiq ko'rsatish — ongli qaror: faqat env (`SHOW_DRAFTS_PUBLICLY=true`) bilan.
SHOW_DRAFTS_PUBLICLY = env.bool("SHOW_DRAFTS_PUBLICLY", default=False)

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=True)
# Health-check load balancer'dan HTTP bilan keladi.
SECURE_REDIRECT_EXEMPT = [r"^api/v1/health/$"]
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = env.int("SECURE_HSTS_SECONDS", default=60 * 60 * 24 * 365)
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[])

DATABASES["default"]["CONN_MAX_AGE"] = env.int("DB_CONN_MAX_AGE", default=60)  # noqa: F405
DATABASES["default"]["CONN_HEALTH_CHECKS"] = True  # noqa: F405
