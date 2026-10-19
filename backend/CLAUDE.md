# Maktab365 — backend

> Bu fayl `backend/` papkasiga tegishli (ildiz qoidalari: `../CLAUDE.md`). Buyruqlar `backend/` ichida, `uv run ...` bilan.

Bitta Django monolit: Python 3.12 · Django 5.2 · DRF · drf-spectacular · simplejwt · Celery + Redis · PostgreSQL · structlog · Sentry · pytest · ruff.

## Tuzilma

- `config/settings/{base,dev,prod,test}.py` — barcha sozlama env orqali (`django-environ`, `.env`). `dev` default (`manage.py`), `prod` — wsgi/asgi, `test` — pytest.
- `config/{urls,celery,asgi,wsgi}.py`.
- `apps/core` — qayta ishlatiladigan poydevor (quyida). `apps/accounts` — foydalanuvchi va profil (quyida). `apps/{content,learning,support,analytics}` — hozircha bo'sh ilovalar; domen mantiqi keyingi bosqichlarda.

## `apps/core` poydevori

- Modellar: `UUIDModel`, `TimeStampedModel`, `SoftDeleteModel` (`objects` — o'chirilmaganlar, `all_objects`, `restore()`, `hard_delete()`).
- `LocalizedTextField` (JSON): kalitlar faqat `uz/ru/en`, `uz` majburiy — frontend `LocalizedText` ga mos.
- Permission'lar: `IsRole("teacher")` (sinf qaytaradi), `IsOwner` (`view.owner_field`, default `user`), `ReadOnlyOrStaff`.
- `exceptions.api_exception_handler` — yagona xato formati `{code, message, details?}`. Yangi domen xatolari `APIException` (`default_code`) orqali; `code` barqaror kalit, `message` foydalanuvchiga ko'rsatilmaydi.
- `pagination.DefaultPagination`, `throttling.*`, `filters.DefaultFilterBackend` (`search_fields`, `ordering_fields`) — DRF default'larida ulangan.
- `middleware.RequestIdMiddleware` — `X-Request-ID` (kelgan yoki yangi), structlog kontekstiga bog'lanadi. Log'lar uchun `structlog.get_logger()`; `print` yo'q.

## `apps/accounts`

- Modellar: `User` (UUID pk, `AUTH_USER_MODEL`; email nullable va katta-kichik harfsiz unique; parol ixtiyoriy; `SoftDeleteModel`), `Profile` (OneToOne; `onboarded_at=null` — onboarding tugamagan), `Identity` (unique `provider+provider_uid`), `AuthEvent` (audit).
- Rolni **faqat** `services.change_role` o'zgartiradi: oddiy foydalanuvchi student↔teacher, editor/admin faqat admin tomonidan (`actor=`). Xato kodlari: `role_forbidden` (403), `invalid_role`.
- `services.py` — onboarding, profil, `delete_account` (soft delete + anonimlashtirish: email/identity/profil tozalanadi, `is_active=False`, IP/UA o'chadi), `export_data`.
- Endpoint'lar (`/api/v1/me/`): `GET/PATCH/DELETE`, `POST onboarding/`, `PATCH role/`, `GET export/`. Autentifikatsiya (JWT berish) — M3.
- Parol: Argon2 birinchi hasher, validatorlar (min 8, umumiy, faqat raqam emas) — parol o'rnatadigan oqimlar `validate_password` ni chaqirishi shart.

## Qoidalar

1. API prefiksi `/api/v1`, JSON kalitlari `snake_case`. Yangi view'ga `@extend_schema` bilan operation_id va javob tiplarini bering.
2. API o'zgarsa: `make schema && make types`, `backend/openapi.yaml` va `frontend/src/lib/api/schema.ts` ni commit qiling (CI farqni tekshiradi).
3. Xatolarni qo'lda `Response({"error": ...})` bilan qaytarmang — exception ko'taring.
4. Migratsiyalar commit qilinadi; CI `makemigrations --check` ni tekshiradi.
5. Sirlar faqat env'da; `.env` commit qilinmaydi, shablon — `.env.example`.
6. `/api/schema/` va `/api/docs/` faqat `ENABLE_API_DOCS=True` (dev/test) da yoqiladi.

## Buyruqlar

- `uv run pytest` (PostgreSQL kerak: default `DATABASE_URL` — compose'dagi postgres, `make test` uni o'zi ko'taradi)
- `uv run ruff check .` · `uv run ruff format .`
- `uv run python manage.py makemigrations --check --dry-run`
- `make schema` — `openapi.yaml` ni yozadi.
