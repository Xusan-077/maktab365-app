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

`.env.example` ga qarang. Muhimlari: `SECRET_KEY`, `DATABASE_URL`, `REDIS_URL`, `FRONTEND_ORIGINS` (CORS faqat shu origin'lar), `SENTRY_DSN` (ixtiyoriy). Production: `DJANGO_SETTINGS_MODULE=config.settings.prod`, `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`.

## Xavfsizlik qarorlari

- **Refresh reuse.** Aylantirilgan (blacklist'langan) refresh qayta kelsa, `REFRESH_REUSE_GRACE_SECONDS` (default 10) dan keyin foydalanuvchining barcha refresh tokenlari bekor qilinadi va `refresh_reuse_detected` hodisasi yoziladi (IP, user agent; token yoki xesh yo'q). Grace ichida (ikki tab, poyga) faqat 401 qaytadi.
- **`refresh/` va `logout/` throttle'siz.** Ongli qaror: so'rovlar Next serveridan keladi (bitta IP), IP bo'yicha cheklov oddiy foydalanuvchilarni bloklardi. Token o'zi kalit (imzolangan, taxmin qilib bo'lmaydi); `logout` idempotent, `refresh` bir martalik.
- **Dev'da konsol email.** `EMAIL_URL` berilmasa xatlar (tasdiqlash/tiklash havolasi tokeni bilan) konsolga chiqadi. Faqat dev uchun; prod'da `EMAIL_URL` SMTP'ga o'rnatiladi.

