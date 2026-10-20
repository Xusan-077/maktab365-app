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

