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
- `net.client_ip(request)` — mijoz IP (throttle va audit uchun yagona manba): `X-Forwarded-For` faqat `X-Forwarded-Secret == FORWARDED_IP_SECRET` (Next serveri) bo'lsa, aks holda `TRUSTED_PROXY_HOPS` bo'yicha o'ngdan yoki `REMOTE_ADDR`. Xom XFF'ni o'qimang.
- `middleware.RequestIdMiddleware` — `X-Request-ID` (kelgan yoki yangi), structlog kontekstiga bog'lanadi. Log'lar uchun `structlog.get_logger()`; `print` yo'q.

## `apps/accounts`

- Modellar: `User` (UUID pk, `AUTH_USER_MODEL`; email nullable va katta-kichik harfsiz unique; parol ixtiyoriy; `SoftDeleteModel`), `Profile` (OneToOne; `onboarded_at=null` — onboarding tugamagan), `Identity` (unique `provider+provider_uid`), `AuthEvent` (audit).
- Rolni **faqat** `services.change_role` o'zgartiradi: oddiy foydalanuvchi student↔teacher, editor/admin faqat admin tomonidan (`actor=`). Xato kodlari: `role_forbidden` (403), `invalid_role`.
- `services.py` — onboarding, profil, `delete_account` (soft delete + anonimlashtirish: email/identity/profil tozalanadi, `is_active=False`, IP/UA o'chadi), `export_data`.
- Endpoint'lar (`/api/v1/me/`): `GET/PATCH/DELETE`, `POST onboarding/`, `PATCH role/`, `GET export/`.
- Auth (`/api/v1/auth/`, M3): `register/`, `login/` → `{access, refresh, user, is_new}`; `refresh/` (rotation + blacklist, bir martalik), `logout/` (idempotent), `logout-all/`, `email/verify/`, `email/resend/` (60s cooldown), `password/forgot/` (doim 200), `password/reset/`, `password/change/` (`refresh` berilsa shu sessiya qoladi, qolganlari blacklist). Mantiq `auth_services.py` da, view'lar `auth_views.py`.
- `VerificationToken`: faqat SHA-256 xeshi saqlanadi, bir martalik (`select_for_update`), tasdiqlash 24 soat, tiklash 1 soat; email o'zgarsa eski havola o'ladi. Yangi token shu maqsaddagi eskilarini bekor qiladi.
- Xavfsizlik: `AuthRateThrottle` (IP) + `AuthEmailThrottle` (email xeshi), ketma-ket `AUTH_LOCKOUT_THRESHOLD` xatodan keyin email `AUTH_LOCKOUT_SECONDS` ga bloklanadi (cache/Redis, `login_locked` 429). Kirishda akkaunt yo'q/parolsiz bo'lsa ham xesh hisoblanadi (timing); xato bir xil `invalid_credentials`. `forgot` qidiruvni Celery task'ida qiladi. Ro'yxatdan o'tishdagi `email_taken` — ongli ravishda qoldirilgan oshkorlik (throttle bilan cheklangan).
- Maydon xatolari `details` da **kod** sifatida: `email_taken`, `password_too_short|too_common|entirely_numeric|too_similar`, `invalid_password` — matnni frontend i18n tanlaydi. Autentifikatorsiz view'da 401 kerak bo'lsa `AuthenticationFailed` emas, o'z `APIException` (status 401) — DRF aks holda 403 qiladi.
- Xatlar: `tasks.py` (Celery, `transaction.on_commit`), `emails.py` (uz/ru/en matnlari; uz-Cyrl → uz matn, lekin havola `/uz-Cyrl/`), shablon `templates/accounts/email/action.{html,txt}`. `EMAIL_URL` (default konsol; prod SMTP/Resend SMTP), `DEFAULT_FROM_EMAIL`, `FRONTEND_URL`.
- Har auth hodisasi `AuthEvent` ga (`registered`, `login`, `login_failed`, `login_locked`, `logout`, `logout_all`, `email_*`, `password_*`). Refresh — yozilmaydi (shovqin), faqat reuse aniqlansa `refresh_reuse_detected` (grace dan keyin barcha sessiyalar bekor).
- Kirish usullari (M4): `providers/{base,google,telegram,email_otp,sms}.py` — har biri `verify(payload) -> ProviderIdentity`; `social_services.py` — `sign_in` (identity bo'yicha topish → tasdiqlangan email bo'yicha bog'lash → yaratish), `link_identity`/`unlink_identity`/`set_password`; `otp_services.py` — email kodi (`OtpChallenge`, HMAC xesh). Endpoint'lar: `auth/google|telegram|otp/request|otp/verify/` (javob `{access, refresh, user, is_new}`), `me/identities/` (GET), `me/identities/{provider}/` (POST), `me/identities/{id}/` (DELETE), `me/password/set/`. Bog'lash qoidalari — `social_services.py` docstring'i va README "Xavfsizlik qarorlari". Telegram imzosiga `locale` kirmaydi (`SIGNED_FIELDS`). Sozlamalar: `GOOGLE_CLIENT_ID`, `TELEGRAM_BOT_TOKEN`, `OTP_*`.
- Parol: Argon2 birinchi hasher, validatorlar (min 8, umumiy, faqat raqam emas) — parol o'rnatadigan oqimlar `validate_password` ni chaqirishi shart.

## Qoidalar

1. API prefiksi `/api/v1`, JSON kalitlari `snake_case`. Yangi view'ga `@extend_schema` bilan operation_id va javob tiplarini bering.
2. API o'zgarsa: `make schema && make types`, `backend/openapi.yaml` va `frontend/src/lib/api/schema.ts` ni commit qiling (CI farqni tekshiradi).
3. Xatolarni qo'lda `Response({"error": ...})` bilan qaytarmang — exception ko'taring.
4. Migratsiyalar commit qilinadi; CI `makemigrations --check` ni tekshiradi.
5. Sirlar faqat env'da; `.env` commit qilinmaydi, shablon — `.env.example`.
6. `/api/schema/` va `/api/docs/` faqat `ENABLE_API_DOCS=True` (dev/test) da yoqiladi.

## Buyruqlar

- Testlarda Celery eager; `on_commit` task'lari uchun `django_capture_on_commit_callbacks(execute=True)` (qarang `tests/test_auth.py`).
- `uv run pytest` (PostgreSQL kerak: default `DATABASE_URL` — compose'dagi postgres, `make test` uni o'zi ko'taradi)
- `uv run ruff check .` · `uv run ruff format .`
- `uv run python manage.py makemigrations --check --dry-run`
- `make schema` — `openapi.yaml` ni yozadi.
