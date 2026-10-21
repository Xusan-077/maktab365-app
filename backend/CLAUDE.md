# Maktab365 — backend

> Bu fayl `backend/` papkasiga tegishli (ildiz qoidalari: `../CLAUDE.md`). Buyruqlar `backend/` ichida, `uv run ...` bilan.

Bitta Django monolit: Python 3.12 · Django 5.2 · DRF · drf-spectacular · simplejwt · Celery + Redis · PostgreSQL · structlog · Sentry · pytest · ruff.

## Tuzilma

- `config/settings/{base,dev,prod,test}.py` — barcha sozlama env orqali (`django-environ`, `.env`). `dev` default (`manage.py`), `prod` — wsgi/asgi, `test` — pytest.
- `config/{urls,celery,asgi,wsgi}.py`.
- `apps/core` — qayta ishlatiladigan poydevor (quyida). `apps/accounts` — foydalanuvchi va profil (quyida). `apps/content` — kontent (quyida). `apps/learning` — o'qish jarayoni (quyida). `apps/support` — murojaatlar. `apps/analytics` — hozircha bo'sh.

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

## `apps/content`

- Modellar: `Subject`, `Book` (slug butun katalogda unique, frontend kitob id'si: `algebra-9`), `Chapter` (slug = papka nomi), `Topic` (slug kitob ichida unique — shuning uchun `book` `chapter.book` nusxasi, `save()` moslaydi; `status` draft|reviewed|published), `TopicRevision`. Mavzu `save()` da sarlavha/bloklar o'zgargan bo'lsagina revision yaratadi (oxirgi 50 ta); muallif: `topic.revision_author` / `revision_comment`.
- Bloklar sxemasi: `schemas.py` (pydantic) — frontend `src/lib/api/schemas.ts` + `src/lib/content/validate.ts` bilan **1:1**. Blok JSON'i frontend fayllaridagi kabi (camelCase: `answerType`, `sortKey`; widget kind'lari kebab-case: `quadratic-graph`…). `validate_blocks` / `validate_topic_file` `Issue(path, message, code)` qaytaradi (`blocks[3].hint`). Qoida o'zgarsa: avval `contracts/fixtures/` (+ `expected.json`), so'ng ikkala sxema; testlar: `tests/test_schemas.py` va frontend `contract.test.ts`.
- `import_content <papka> [--dry-run]` (`importer.py`): `frontend/src/content` → baza, idempotent, bitta tranzaksiya; fan/kitob metama'lumoti `catalog_seed.py` da (yangi kitob qo'shilsa shu yerga ham). Status faqat ko'tariladi.
- Fayllar: `Book.cover/pdf` — `FileField`; `STORAGES` env bilan (`AWS_STORAGE_BUCKET_NAME` bo'lsa S3-mos, aks holda `media/`).

### Ochiq kontent API (M7)

- `urls.py`/`views.py`: `grades/`, `subjects/`, `books/`, `books/<slug>/`, `books/<book>/topics/<topic>/`, `search/` — `AllowAny`, throttle yo'q (kesh ishlaydi; faqat `search/` umumiy throttle'da). Har `get` `@public_cached` (`cache.py`): Redis'da `content:v<versiya>:<hash>`, `ETag`/304, `Cache-Control: public, max-age=CONTENT_CACHE_MAX_AGE`. Subject/Book/Chapter/Topic saqlanganda/o'chirilganda `signals.py` versiyani almashtiradi (commit'dan keyin); `.update()` bilan yozsangiz `bump_content_version()` ni o'zingiz chaqiring.
- Ko'rinish: `is_staff(user)` (editor/admin/is_staff) hamma statusni ko'radi, javob `private, no-store`. Boshqalar — `published`; `SHOW_DRAFTS_PUBLICLY=true` bo'lsa draft/reviewed ham, `unverified: true` bilan. `topics_ready`/`topics_count` — ko'rinadigan mavzular bo'yicha.
- Qidiruv (`search.py`): `Topic.search_vector` ('simple', A sarlavha / B mazmun / C bloklar) `Topic.save()` da `reindex_topic` bilan yangilanadi (`.update()` ishlatsangiz o'zingiz chaqiring); matn `apps.core.translit.normalize_search_text` (kirill→lotin, tutuqsiz) bilan normallashadi, so'rov atamalari prefiks (`atama:*`) va hammasi kerak. Snippet Python'da, asl matndan, mos so'zlar `⟦…⟧` ichida. Frontend umumiy vektorlar: `contracts/fixtures/translit.json`.
- N+1 yo'q: testlar `django_assert_max_num_queries` bilan (`tests/test_api.py`).

## `apps/learning` (M8)

- Modellar: `TopicProgress` (unique `user+topic`; `read_status` not_started|in_progress|read va `exercise_status` not_started|in_progress|passed — alohida; `last_block_id`, `scroll_position`, `mistakes` `[{exercise_id, attempts, last_wrong_at}]`, `exercise_stats` `{solved, attempts}`, `first_opened_at/read_at/passed_at`, `client_updated_at`), `Bookmark` (`kind` book|topic, `CheckConstraint` + shartli unique), `StudyGoal`, `RecentView` (har foydalanuvchida oxirgi `RECENT_LIMIT=20`).
- Mavzu kaliti: API'da `topic_id` = `{book.slug}-{topic.slug}` (frontend mavzu id'si; `services/topics.py`: `topic_key`, `resolve_topic` — ko'rinish qoidasi ochiq kontent API'si bilan bir xil, ko'rinmaydigan mavzu 404). Yangi so'rovda `Concat` ga `output_field=CharField()` kerak (`key_expr`).
- `services/progress.py`: `apply_update` (PUT) — holatlar `max`, `exercise_stats` birlashma/eng katta, `last_block_id`/`scroll_position`/`mistakes` faqat `updated_at >= client_updated_at` bo'lsa almashadi (kelajak vaqti `now` ga qisqartiriladi); o'zgarish bo'lmasa saqlanmaydi (`updated_at` siljimaydi), bo'sh yozuv qator yaratmaydi. `apply_event`: `exercise_answered` mashq id'sini mavzu bloklaridan tekshiradi (`unknown_exercise` 400), xato — `mistakes` ga, birinchi urinishdagi (`attempt=1`) to'g'ri javob — `mistakes` dan o'chiradi, barcha mashq yechilsa `passed`. Voqealar idempotent emas (urinishlar o'sadi) — oflayn navbat PUT ishlatadi, `events/` faqat `topic_opened` uchun (RecentView).
- `services/review.py` — "Takrorlash kerak" (xatosi bor mavzu; eng ko'p xato, teng bo'lsa eng yangi), o'zlashtirish guruhlari (review/mastered/in_progress), `pick_continue`, haftalik hisob (`jsonb_array_length`). `services/dashboard.py` — kabinet/ustoz yig'ma javoblari (so'rovlar soni ma'lumotga bog'liq emas, testda 14 tagacha).
- `services/merge.py` + `progress.merge_progress`: holatlar eng yuqorisi, xatolar birlashmasi, `last_block_id` — qat'iy yangiroq yozuvniki; takror chaqirish `0` o'zgarish. Ko'rinmaydigan/yo'q mavzu `failed` ro'yxatiga tushadi (butun so'rov muvaffaqiyatsiz bo'lmaydi). Qoida o'zgarsa: avval `contracts/fixtures/merge-*.json`, so'ng backend va `frontend/src/lib/merge-guest-data.ts`.
- Egalik: barcha queryset'lar `user=request.user` bilan; begonaning maqsadi 404. `delete_account` o'qish ma'lumotlarini o'chiradi, `export_data` `learning` beradi.
- Testlar: `apps/learning/tests/` (`conftest.py` — `library`, `api`, `other_api`).

## `apps/support`

- `SupportMessage` (UUID pk): `user?` (SET_NULL), `name`, `email`, `kind` (`question|suggestion|bug|content_error`), `message` (10–2000), `page_url`, `topic`, `user_agent`, `status` (`new|in_progress|resolved|spam`), `staff_note` (faqat admin, API'da yo'q).
- `POST /api/v1/support/` (`AllowAny`, `SupportRateThrottle` — IP bo'yicha, `SUPPORT_THROTTLE_RATE`): kirgan foydalanuvchida `user` va (email berilmasa) email akkauntdan; mehmonda email majburiy. Honeypot (`website` to'ldirilgan) — 201 qaytadi, lekin saqlanmaydi. `spam.is_spam` (ko'p havola, tipik iboralar, takror) — `status=spam` bilan saqlanadi, staff'ga xat ketmaydi. Javob doim `{ok: true}`.
- Yangi (spam bo'lmagan) xabarda `tasks.notify_staff` (Celery, `on_commit`) `SUPPORT_NOTIFY_EMAILS` ga yuboradi; bo'sh bo'lsa hech narsa.
- `GET /api/v1/me/support/` — o'z murojaatlari (paginatsiyalangan, spam ko'rsatilmaydi).

## Admin API (M10)

- `/api/v1/admin/` (`admin_urls.py`; view'lar `admin_views.py`, serializer'lar `admin_serializers.py`, mantiq `admin_services.py`): ruxsat `IsRole("editor","admin")`, o'chirish faqat `admin`. Lookup — UUID `id`; slug yaratishda beriladi va keyin o'zgarmaydi (`slug_immutable`), chunki u kitob/mavzu identifikatorlariga (`{kitob}-{mavzu}`) kiradi. `order` server tomonda: yangi bob/mavzu oxiriga qo'shiladi, o'zgartirish faqat `reorder` orqali. Mavzu `status` faqat `transition` bilan o'zgaradi.
- `POST books/{id}/reorder/ {chapters?: [id…], topics?: {bob_id: [mavzu_id…]}}` — `reorder_book`: `chapters` kitobning barcha boblari, har `topics` ro'yxati o'sha bobning to'liq yangi tarkibi (mavzuni boshqa bobga ko'chirish uchun ikkala bobni bering). `bulk_update` signal bermaydi — `bump_content_version` o'zi chaqiriladi.
- Nashr qoidalari `admin_services.TRANSITIONS` da (frontend `lib/admin/permissions.ts` nusxasi); xato kodlari `invalid_transition` (400), `transition_forbidden` (403). `reviewed_by/at`, `published_at` shu yerda yoziladi, draft'ga qaytganda tozalanadi.
- `POST uploads/` (multipart `file`, `kind` = cover|image|pdf): hajm `ADMIN_UPLOAD_MAX_IMAGE_BYTES/PDF_BYTES`, tur fayl boshidagi imzo bilan (JPEG/PNG/WebP/PDF; SVG yo'q) va mijoz `Content-Type` bilan mos bo'lishi shart, nom `slug-<uuid8>.<ext>` ga tozalanadi, `default_storage` (S3-mos) ga yoziladi. Kitob `cover`/`pdf` maydoniga yuklash natijasidagi `path` beriladi (`StoredPathField`: prefiks va mavjudlik tekshiriladi).
- Audit: `apps/accounts/audit.py` — `record(actor, action, target_type, target_id, label=, before=, after=, request=)` va `snapshot(instance, fields)`; model `AuditLog`. Boshqa app'lar ham shuni ishlatadi. `blocks` jurnalga tushmaydi (faqat `blocks_count`).
- Xato kodlari `fields` darajasida (`details`): `slug_taken`, `slug_immutable`, `book_immutable`, `invalid_file`, `must_list_all_chapters`, `must_list_all_topics`, `unknown_or_duplicate_topic`, `unknown_chapter`. Fan o'chirish kitob bor bo'lsa `has_dependents` (409).
- Testlar: `apps/content/tests/test_admin_api.py` (ruxsat matritsasi anon/student/teacher/editor/admin, nashr qoidalari, reorder, yuklash tekshiruvlari, dashboard).

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
