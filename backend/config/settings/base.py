import os
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
    # R2/S3: imzolangan URL'lar v4 bilan; katta PDF tekshiruvi diskka tushadi (RAM'ga emas).
    AWS_S3_SIGNATURE_VERSION = env("AWS_S3_SIGNATURE_VERSION", default="s3v4")
    AWS_S3_MAX_MEMORY_SIZE = 16 * 1024 * 1024

# --- Admin yuklashlari (apps/content/admin_services.py) ---
ADMIN_UPLOAD_MAX_IMAGE_BYTES = env.int("ADMIN_UPLOAD_MAX_IMAGE_BYTES", default=5 * 1024 * 1024)
ADMIN_UPLOAD_MAX_PDF_BYTES = env.int("ADMIN_UPLOAD_MAX_PDF_BYTES", default=50 * 1024 * 1024)

# --- PDF darsliklar (apps/content/pdf_*.py) ---
PDF_BOOK_MAX_BYTES = env.int("PDF_BOOK_MAX_BYTES", default=100 * 1024 * 1024)
# Obyekt saqlashga to'g'ridan-to'g'ri multipart yuklash: har bo'lak (R2/S3 kamida 5 MiB).
PDF_UPLOAD_PART_BYTES = env.int("PDF_UPLOAD_PART_BYTES", default=8 * 1024 * 1024)
# Imzolangan o'qish/yuklash URL'lari muddati (soniya); 10–15 daqiqa tavsiya etiladi.
PDF_SIGNED_URL_SECONDS = env.int("PDF_SIGNED_URL_SECONDS", default=15 * 60)
# Admin yuklash endpointlari (init/upload/complete): foydalanuvchi bo'yicha.
PDF_UPLOAD_THROTTLE_RATE = env("PDF_UPLOAD_THROTTLE_RATE", default="60/hour")

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
        "auth": env("AUTH_THROTTLE_RATE", default="10/min"),  # e2e uchun env bilan oshiriladi
        "auth_email": "5/min",
        # Yordam murojaatlari: IP bo'yicha soatiga 5 ta (e2e uchun env bilan oshiriladi).
        "support": env("SUPPORT_THROTTLE_RATE", default="5/hour"),
        "pdf_upload": PDF_UPLOAD_THROTTLE_RATE,
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
# Aylantirilgan refresh shuncha soniya ichida qayta kelsa oila bekor qilinmaydi (ikki tab, poyga).
REFRESH_REUSE_GRACE_SECONDS = env.int("REFRESH_REUSE_GRACE_SECONDS", default=10)
# Email havolalari shu manzilga olib boradi: {FRONTEND_URL}/{locale}/email-tasdiqlash?token=...
FRONTEND_URL = env("FRONTEND_URL", default="http://localhost:3000").rstrip("/")
AUTH_EMAIL_VERIFY_TTL = timedelta(hours=env.int("AUTH_EMAIL_VERIFY_HOURS", default=24))
AUTH_PASSWORD_RESET_TTL = timedelta(hours=env.int("AUTH_PASSWORD_RESET_HOURS", default=1))
AUTH_RESEND_COOLDOWN_SECONDS = env.int("AUTH_RESEND_COOLDOWN_SECONDS", default=60)
# Ketma-ket shuncha noto'g'ri parol (email bo'yicha) — vaqtinchalik bloklash (cache/Redis).
AUTH_LOCKOUT_THRESHOLD = env.int("AUTH_LOCKOUT_THRESHOLD", default=5)
AUTH_LOCKOUT_SECONDS = env.int("AUTH_LOCKOUT_SECONDS", default=15 * 60)
# Env admin: shu email/parol bilan login formasidan kirilsa admin akkaunt yaratiladi/yangilanadi.
# Ikkalasi ham to'ldirilmasa bu yo'l butunlay o'chiq. Parol hech qayerga yozilmaydi.
ADMIN_EMAIL = env("ADMIN_EMAIL", default="").strip().lower()
ADMIN_PASSWORD = env("ADMIN_PASSWORD", default="")

# --- Kirish usullari: Google, Telegram, email OTP ---
# Google OAuth client ID (id_token `aud`); frontend GOOGLE_CLIENT_ID bilan bir xil. Bo'sh — o'chiq.
GOOGLE_CLIENT_ID = env("GOOGLE_CLIENT_ID", default="")
# @BotFather bergan token; Telegram Login Widget imzosi shu bilan tekshiriladi. Bo'sh — o'chiq.
TELEGRAM_BOT_TOKEN = env("TELEGRAM_BOT_TOKEN", default="")
TELEGRAM_AUTH_MAX_AGE_SECONDS = env.int("TELEGRAM_AUTH_MAX_AGE_SECONDS", default=5 * 60)
OTP_TTL = timedelta(minutes=env.int("OTP_TTL_MINUTES", default=10))
OTP_MAX_ATTEMPTS = env.int("OTP_MAX_ATTEMPTS", default=5)
OTP_RESEND_COOLDOWN_SECONDS = env.int("OTP_RESEND_COOLDOWN_SECONDS", default=60)
# Faqat dev (e2e): yuborilgan kodni `GET /api/v1/dev/otp/?email=` qaytaradi. dev.py yoqadi.
OTP_DEV_INBOX = False

# --- Email: dev — konsol, prod — SMTP (Resend ham SMTP orqali), EMAIL_URL bilan ---
# Masalan: EMAIL_URL=smtp+tls://resend:re_xxx@smtp.resend.com:587
vars().update(env.email_url("EMAIL_URL", default="consolemail://"))
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="maktab365 <no-reply@maktab365.uz>")

# Yangi murojaatlar haqida xabar oladigan staff email'lari (vergul bilan); bo'sh — xat yo'q.
SUPPORT_NOTIFY_EMAILS = env.list("SUPPORT_NOTIFY_EMAILS", default=[])

SPECTACULAR_SETTINGS = {
    "TITLE": "Maktab365 API",
    "DESCRIPTION": "Maktab365 platformasi API'si.",
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "SCHEMA_PATH_PREFIX": r"/api/v1",
    "COMPONENT_SPLIT_REQUEST": True,
    "SORT_OPERATIONS": False,
    "POSTPROCESSING_HOOKS": [
        "drf_spectacular.hooks.postprocess_schema_enums",
        "apps.core.openapi.sort_path_methods",
    ],
    "ENUM_NAME_OVERRIDES": {
        "CheckStatusEnum": "apps.core.views.CHECK_STATUS_CHOICES",
        "RoleEnum": "apps.accounts.models.Role.choices",
        "OnboardingRoleEnum": "apps.accounts.serializers.ONBOARDING_ROLES",
        "LocaleEnum": "apps.accounts.models.Locale.choices",
        "SupportKindEnum": "apps.support.models.Kind.choices",
        "SupportStatusEnum": "apps.support.models.Status.choices",
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
# Worker'siz lokal ishga tushirish (va e2e) uchun: CELERY_TASK_ALWAYS_EAGER=true
CELERY_TASK_ALWAYS_EAGER = env.bool("CELERY_TASK_ALWAYS_EAGER", default=False)
CELERY_TASK_TIME_LIMIT = 60 * 5

# --- Sentry ---
SENTRY_DSN = env("SENTRY_DSN", default="")
if SENTRY_DSN:
    import sentry_sdk

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        environment=env("SENTRY_ENVIRONMENT", default="development"),
        release=os.environ.get("RAILWAY_GIT_COMMIT_SHA") or None,
        traces_sample_rate=env.float("SENTRY_TRACES_SAMPLE_RATE", default=0.0),
        send_default_pii=False,
    )

# --- Logging (structlog, JSON) ---
from apps.core.logging import build_logging_config, configure_structlog  # noqa: E402

LOGGING = build_logging_config(debug=DEBUG)
configure_structlog()
