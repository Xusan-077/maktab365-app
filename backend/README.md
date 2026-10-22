# Backend

Django + DRF API. Qoidalar va tuzilma: [`CLAUDE.md`](CLAUDE.md). API shartnomasi: [`openapi.yaml`](openapi.yaml) (`make schema`).

## Ishga tushirish

Ildizdan (Docker kerak):

```bash
cp backend/.env.example backend/.env
make dev        # postgres + redis + backend (hot reload) + worker, so'ng frontend
make migrate    # (backend konteyneri o'zi ham migrate qiladi)
```

- API: http://localhost:8000/api/v1/health/
- Swagger (faqat dev): http://localhost:8000/api/docs/

Docker'siz: Python 3.12 va [uv](https://docs.astral.sh/uv/), Postgres + Redis alohida.

```bash
cd backend
uv sync
uv run python manage.py migrate
uv run python manage.py runserver
```

## Tekshiruvlar

```bash
make test       # postgres'ni ko'taradi; backend (pytest, PostgreSQL) + frontend (typecheck, vitest)
make lint       # ruff + eslint
make schema     # backend/openapi.yaml ni yangilaydi
make types      # frontend/src/lib/api/schema.ts ni yangilaydi
```

`pre-commit install` — ruff'ni commit oldidan ishga tushiradi (ildizdagi `.pre-commit-config.yaml`).

## Muhit o'zgaruvchilari

`.env.example` ga qarang. Muhimlari: `SECRET_KEY`, `DATABASE_URL`, `REDIS_URL`, `FRONTEND_ORIGINS` (CORS faqat shu origin'lar), `SENTRY_DSN` (ixtiyoriy), `SUPPORT_NOTIFY_EMAILS` (yordam murojaatlari haqida xabar oladigan staff email'lari, vergul bilan; bo'sh bo'lsa xat yuborilmaydi), `SUPPORT_THROTTLE_RATE` (default `5/hour`, IP bo'yicha). Production: `DJANGO_SETTINGS_MODULE=config.settings.prod`, `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`.

## Xavfsizlik qarorlari

- **Refresh reuse.** Faqat aylantirish (rotation) natijasida bekor bo'lgan refresh (`RotatedRefreshToken`) qayta kelsa, `REFRESH_REUSE_GRACE_SECONDS` (default 10) dan keyin foydalanuvchining barcha refresh tokenlari bekor qilinadi va `refresh_reuse_detected` hodisasi yoziladi (IP, user agent; token yoki xesh yo'q). Grace ichida (ikki tab, poyga) faqat 401 qaytadi. Logout, parol almashtirish va boshqa qo'lda bekor qilingan tokenlar qayta kelsa ham oddiy 401: oila bekor qilinmaydi, hodisa yozilmaydi.
- **`refresh/` va `logout/` throttle'siz.** Ongli qaror: so'rovlar Next serveridan keladi (bitta IP), IP bo'yicha cheklov oddiy foydalanuvchilarni bloklardi. Token o'zi kalit (imzolangan, taxmin qilib bo'lmaydi); `logout` idempotent, `refresh` bir martalik.
- **Dev'da konsol email.** `EMAIL_URL` berilmasa xatlar (tasdiqlash/tiklash havolasi tokeni bilan) konsolga chiqadi. Faqat dev uchun; prod'da `EMAIL_URL` SMTP'ga o'rnatiladi.
- **Kirish usullarini bog'lash (Google, Telegram, email OTP).** Provayder bergan TASDIQLANGAN email bo'yicha mavjud TASDIQLANGAN akkaunt topilsa — avtomatik bog'lanadi. Mavjud akkaunt emaili tasdiqlanmagan bo'lsa Google bog'lamaydi (`email_unverified_account`, 409): birovning emailiga oldindan ochilgan akkaunt bilan o'g'irlash yo'li yopiladi. Istisno — email OTP: kod email egaligini isbotlaydi, akkaunt tasdiqlanadi, lekin oldindan qo'yilgan parol va barcha sessiyalar bekor qilinadi. Telegram email bermaydi, faqat o'z identity'si bo'yicha topiladi.
- **Telegram.** Imzo HMAC-SHA256 (kalit = SHA256(`TELEGRAM_BOT_TOKEN`)), `auth_date` 5 daqiqadan eski (yoki 30 soniyadan ortiq kelajakdagi) bo'lsa rad etiladi, bir xil imzo ikkinchi marta qabul qilinmaydi (cache/Redis, `provider_auth_replayed`).
- **Email OTP.** 6 xonali kod, 10 daqiqa, bazada faqat HMAC xeshi (`SECRET_KEY` bilan), 5 xato urinishdan keyin bloklanadi (`otp_locked`), qayta so'rash 60 soniyada bir marta, throttle IP va email bo'yicha. Yangi so'rov eski kodni bekor qiladi. SMS OTP (Eskiz.uz) uchun `providers/sms.py` da interfeys bor, implementatsiya keyin.
- **Oxirgi kirish usulini o'chirib bo'lmaydi** (`last_identity`, 409). Parolsiz akkaunt `POST /me/password/set/` bilan parol qo'yadi.
- **Dev qulayliklari prod'da yopiq.** `prod.py` `OTP_DEV_INBOX` va `CELERY_TASK_ALWAYS_EAGER` ni env'dan qat'i nazar `False` qiladi; `/api/v1/dev/otp/` prod'da 404 (`apps/core/tests/test_prod_settings.py`).


## Production: Railway (backend) + Vercel (frontend) + Cloudflare R2 (PDF)

### Railway env o'zgaruvchilari (backend)

Majburiy:

| O'zgaruvchi | Qiymat / izoh |
| --- | --- |
| `DJANGO_SETTINGS_MODULE` | `config.settings.prod` |
| `SECRET_KEY` | uzun tasodifiy qiymat (kamida 50 belgi) |
| `ALLOWED_HOSTS` | `api.maktab365.uz` (vergul bilan) |
| `CSRF_TRUSTED_ORIGINS` | `https://api.maktab365.uz` |
| `FRONTEND_ORIGINS` | `https://maktab365.uz` (CORS, vergul bilan) |
| `FRONTEND_URL` | `https://maktab365.uz` (email havolalari) |
| `DATABASE_URL` | Railway Postgres |
| `REDIS_URL` | Railway Redis (kesh va Celery) |
| `FORWARDED_IP_SECRET` | Vercel'dagi `BACKEND_FORWARD_SECRET` bilan bir xil, kuchli qiymat |
| `TRUSTED_PROXY_HOPS` | Railway proxy ortida: `1` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | `python manage.py create_admin` uchun (faqat Railway env'da) |
| `AWS_STORAGE_BUCKET_NAME` | R2 bucket nomi |
| `AWS_S3_ENDPOINT_URL` | `https://<account_id>.r2.cloudflarestorage.com` |
| `AWS_S3_REGION_NAME` | `auto` |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | R2 API token (Object Read & Write, shu bucket) |
| `EMAIL_URL`, `DEFAULT_FROM_EMAIL` | SMTP (masalan Resend), xat yuborish uchun |

Ixtiyoriy (default'lar `.env.example` da):

`AWS_S3_CUSTOM_DOMAIN` (muqova rasmlari uchun ommaviy domen), `AWS_S3_SIGNATURE_VERSION` (`s3v4`),
`PDF_BOOK_MAX_BYTES` (104857600), `PDF_UPLOAD_PART_BYTES` (8388608), `PDF_SIGNED_URL_SECONDS` (900; tavsiya 600–900),
`PDF_UPLOAD_THROTTLE_RATE` (60/hour), `ADMIN_UPLOAD_MAX_IMAGE_BYTES`, `ADMIN_UPLOAD_MAX_PDF_BYTES`,
`SHOW_DRAFTS_PUBLICLY` (prod'da qo'ymang: default `false`), `CONTENT_CACHE_MAX_AGE` (60),
`JWT_ACCESS_MINUTES`, `JWT_REFRESH_DAYS`, `REFRESH_REUSE_GRACE_SECONDS`, `AUTH_THROTTLE_RATE`, `AUTH_LOCKOUT_THRESHOLD`,
`AUTH_LOCKOUT_SECONDS`, `OTP_TTL_MINUTES`, `OTP_MAX_ATTEMPTS`, `OTP_RESEND_COOLDOWN_SECONDS`, `GOOGLE_CLIENT_ID`,
`TELEGRAM_BOT_TOKEN`, `SUPPORT_NOTIFY_EMAILS`, `SUPPORT_THROTTLE_RATE`, `SENTRY_DSN`, `SENTRY_ENVIRONMENT`,
`DB_CONN_MAX_AGE`, `SECURE_SSL_REDIRECT`, `SECURE_HSTS_SECONDS`.

Deploy buyruqlari: `python manage.py migrate --noinput && python manage.py create_admin` (env bo'sh bo'lsa xato —
birinchi deploydan keyin olib tashlash mumkin; jim variant: `ensure_admin`), keyin web va `celery -A config worker`.

### Vercel env o'zgaruvchilari (frontend, Root Directory = `frontend`)

`NEXT_PUBLIC_API_MODE=http`, `API_URL=https://api.maktab365.uz`, `NEXT_PUBLIC_SITE_URL`, `AUTH_SECRET`, `AUTH_URL`,
`BACKEND_FORWARD_SECRET` (Railway'dagi `FORWARDED_IP_SECRET` bilan bir xil), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`.

### Cloudflare R2

1. Bucket yarating (maxfiy qoladi: PDF faqat imzolangan URL bilan beriladi), API token oling.
2. Bucket → Settings → CORS policy'ga quyidagini to'liq qo'ying (`<sayt-domeni>` ni almashtiring). Brauzer PDF'ni
   to'g'ridan-to'g'ri yuklaydi (`PUT`) va Range bilan o'qiydi (`GET`); `ETag` ochiq bo'lmasa multipart yuklash tugamaydi.

```json
[
  {
    "AllowedOrigins": ["https://<sayt-domeni>", "https://*.vercel.app"],
    "AllowedMethods": ["GET", "HEAD", "PUT"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Content-Length", "Content-Range", "Accept-Ranges"],
    "MaxAgeSeconds": 3600
  }
]
```

3. Muqova rasmlari ochiq URL talab qiladi: bucket'ga ommaviy domen ulang va `AWS_S3_CUSTOM_DOMAIN` ga yozing.

### openapi.yaml

`make schema` natijasi barqaror: `apps/core/openapi.py` hook'i metodlarni qat'iy tartibga soladi
(`PYTHONHASHSEED` ga bog'liq emas), shuning uchun CI farqi soxta o'zgarish ko'rsatmaydi.
