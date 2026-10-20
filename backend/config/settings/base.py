from datetime import timedelta
from pathlib import Path

import environ
from corsheaders.defaults import default_headers

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env()
environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env("SECRET_KEY")
DEBUG = env.bool("DEBUG", default=False)
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=[])

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "drf_spectacular",
    "corsheaders",
    "storages",
    "apps.core",
    "apps.accounts",
    "apps.content",
    "apps.learning",
    "apps.support",
    "apps.analytics",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "apps.core.middleware.RequestIdMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

DATABASES = {"default": env.db("DATABASE_URL")}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REDIS_URL = env("REDIS_URL", default="redis://localhost:6379/0")
CACHES = {"default": env.cache_url("CACHE_URL", default=REDIS_URL)}

AUTH_USER_MODEL = "accounts.User"

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
]
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "uz"
TIME_ZONE = "Asia/Tashkent"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# --- Fayllar (muqova, PDF): dev'da lokal papka, S3-mos saqlash (AWS S3, R2, MinIO) env bilan ---
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}
if env("AWS_STORAGE_BUCKET_NAME", default=""):
    STORAGES["default"] = {"BACKEND": "storages.backends.s3.S3Storage"}
    AWS_STORAGE_BUCKET_NAME = env("AWS_STORAGE_BUCKET_NAME")
    AWS_S3_ENDPOINT_URL = env("AWS_S3_ENDPOINT_URL", default=None)
    AWS_S3_REGION_NAME = env("AWS_S3_REGION_NAME", default=None)
    AWS_S3_CUSTOM_DOMAIN = env("AWS_S3_CUSTOM_DOMAIN", default=None)
    AWS_QUERYSTRING_AUTH = False
    AWS_DEFAULT_ACL = None

# --- Ochiq kontent API ---
# true bo'lsa draft/reviewed mavzular ochiq API'da `unverified: true` bilan chiqadi. Default false
# (faqat published); dev'da `dev.py` uni yoqadi, prod'da faqat env bilan ongli ravishda.
SHOW_DRAFTS_PUBLICLY = env.bool("SHOW_DRAFTS_PUBLICLY", default=False)
CONTENT_CACHE_MAX_AGE = env.int("CONTENT_CACHE_MAX_AGE", default=60)

# --- DRF ---
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticatedOrReadOnly"],
    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.DefaultPagination",
    "DEFAULT_FILTER_BACKENDS": ["apps.core.filters.DefaultFilterBackend"],
    "DEFAULT_THROTTLE_CLASSES": [
        "apps.core.throttling.AnonBurstThrottle",
        "apps.core.throttling.UserBurstThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "60/min",
        "user": "240/min",
        # Kirish/ro'yxatdan o'tish/parol tiklash: IP va email bo'yicha alohida.
        "auth": "10/min",
        "auth_email": "5/min",
    },
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "apps.core.exceptions.api_exception_handler",
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "PAGE_SIZE": 20,
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=env.int("JWT_ACCESS_MINUTES", default=15)),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=env.int("JWT_REFRESH_DAYS", default=30)),
    # Har refresh yangi refresh beradi, eskisi blacklist'ga tushadi (bir martalik).
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": False,
}

# --- Auth (email + parol) ---
# Email havolalari shu manzilga olib boradi: {FRONTEND_URL}/{locale}/email-tasdiqlash?token=...
FRONTEND_URL = env("FRONTEND_URL", default="http://localhost:3000").rstrip("/")
AUTH_EMAIL_VERIFY_TTL = timedelta(hours=env.int("AUTH_EMAIL_VERIFY_HOURS", default=24))
AUTH_PASSWORD_RESET_TTL = timedelta(hours=env.int("AUTH_PASSWORD_RESET_HOURS", default=1))
AUTH_RESEND_COOLDOWN_SECONDS = env.int("AUTH_RESEND_COOLDOWN_SECONDS", default=60)
# Ketma-ket shuncha noto'g'ri parol (email bo'yicha) — vaqtinchalik bloklash (cache/Redis).
AUTH_LOCKOUT_THRESHOLD = env.int("AUTH_LOCKOUT_THRESHOLD", default=5)
AUTH_LOCKOUT_SECONDS = env.int("AUTH_LOCKOUT_SECONDS", default=15 * 60)

# --- Email: dev — konsol, prod — SMTP (Resend ham SMTP orqali), EMAIL_URL bilan ---
# Masalan: EMAIL_URL=smtp+tls://resend:re_xxx@smtp.resend.com:587
vars().update(env.email_url("EMAIL_URL", default="consolemail://"))
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="maktab365 <no-reply@maktab365.uz>")

SPECTACULAR_SETTINGS = {
    "TITLE": "Maktab365 API",
    "DESCRIPTION": "Maktab365 platformasi API'si.",
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "SCHEMA_PATH_PREFIX": r"/api/v1",
    "COMPONENT_SPLIT_REQUEST": True,
    "SORT_OPERATIONS": False,
    "ENUM_NAME_OVERRIDES": {
        "CheckStatusEnum": "apps.core.views.CHECK_STATUS_CHOICES",
        "RoleEnum": "apps.accounts.models.Role.choices",
        "OnboardingRoleEnum": "apps.accounts.serializers.ONBOARDING_ROLES",
        "LocaleEnum": "apps.accounts.models.Locale.choices",
    },
}

# --- Mijoz IP (throttle, audit): qarang apps/core/net.py ---
# Next serveri (BFF, Auth.js) bilan umumiy sir: faqat u yuborgan X-Forwarded-For'ga ishoniladi.
FORWARDED_IP_SECRET = env("FORWARDED_IP_SECRET", default="")
# Backend oldidagi ishonchli proxy'lar soni (0 — to'g'ridan-to'g'ri, REMOTE_ADDR).
TRUSTED_PROXY_HOPS = env.int("TRUSTED_PROXY_HOPS", default=0)

# --- CORS: faqat env'dagi frontend origin'lari ---
CORS_ALLOWED_ORIGINS = env.list("FRONTEND_ORIGINS", default=["http://localhost:3000"])
CORS_ALLOW_CREDENTIALS = False
CORS_ALLOW_HEADERS = [*default_headers, "x-request-id"]
CORS_EXPOSE_HEADERS = ["X-Request-ID"]

# --- Celery ---
CELERY_BROKER_URL = env("CELERY_BROKER_URL", default=REDIS_URL)
CELERY_RESULT_BACKEND = env("CELERY_RESULT_BACKEND", default=REDIS_URL)
CELERY_TASK_ALWAYS_EAGER = False
CELERY_TASK_TIME_LIMIT = 60 * 5

# --- Sentry ---
SENTRY_DSN = env("SENTRY_DSN", default="")
if SENTRY_DSN:
    import sentry_sdk

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        environment=env("SENTRY_ENVIRONMENT", default="development"),
        traces_sample_rate=env.float("SENTRY_TRACES_SAMPLE_RATE", default=0.0),
        send_default_pii=False,
    )

# --- Logging (structlog, JSON) ---
from apps.core.logging import build_logging_config, configure_structlog  # noqa: E402

LOGGING = build_logging_config(debug=DEBUG)
configure_structlog()
