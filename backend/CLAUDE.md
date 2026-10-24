# Maktab365 — backend

> Bu fayl `backend/` papkasiga tegishli (ildiz qoidalari: `../CLAUDE.md`). Buyruqlar `backend/` ichida, `uv run ...` bilan.

Bitta Django monolit: Python 3.12 · Django 5.2 · DRF · drf-spectacular · simplejwt · Celery + Redis · PostgreSQL · structlog · Sentry · pytest · ruff.

## Tuzilma

- `config/settings/{base,dev,prod,test}.py` — barcha sozlama env orqali (`django-environ`, `.env`). `dev` default (`manage.py`), `prod` — wsgi/asgi, `test` — pytest.
- `config/{urls,celery,asgi,wsgi}.py`.
- `apps/core` — qayta ishlatiladigan poydevor (quyida). `apps/accounts` — foydalanuvchi va profil (quyida). `apps/content` — kontent (quyida). `apps/learning` — o'qish jarayoni (quyida). `apps/support` — murojaatlar. `apps/analytics` — kitob/sahifa kunlik sanagichlari (anonim, faqat son): `BookDailyStat`, `PageDailyStat`, `POST pdf-books/{id}/stats/` (throttle `STATS_THROTTLE_RATE`), admin `GET /admin/stats/?days=7|30`, `manage.py purge_stats`.

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
- Env admin (M13): `settings.ADMIN_EMAIL/ADMIN_PASSWORD` bo'sh bo'lmasa `auth_services.authenticate_password` shu emailga faqat env parolini qabul qiladi (`hmac.compare_digest`), `admin_bootstrap.sync_env_admin` akkauntni yaratadi/yangilaydi (`User.is_env_admin`, parol xeshi faqat o'zgarganda), qolgan hammasi (lockout, throttle, audit) umumiy yo'l bilan. Shu emailga ro'yxatdan o'tib bo'lmaydi. Parolni hech qayerga yozmang.
- Admin foydalanuvchilar (`/api/v1/admin/users/`, `admin_user_views.py`, `admin_user_services.py`, faqat admin): yaratish (parol yoki bir martalik `temporary_password`), rol, bloklash (`blacklist_all`), o'chirish (`delete_account`). Himoyalar servisda: `env_admin_protected`, `self_action_forbidden`, `last_admin`; `AuditLog` (`create|role_change|block|unblock|update|delete`, parolsiz). `is_staff`/`is_superuser` rolga moslanadi. Admin o'quvchi API'larida (`IsLearner`) 403.
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

- Modellar: `Subject` (slug unique, `title` LocalizedText, `icon`, `order`, `group` exact|natural|language|social|arts|'' — katalog tablari; `seed_subjects` guruhi bo'shlarga qo'yadi) va `PdfBook` (qarang "PDF darsliklar"). Mavzu tizimi
  (`Book`, `Chapter`, `Topic`, `TopicRevision`, mavzu bloklari, `import_content`, qidiruv indeksi) olib tashlangan
  (`content 0004`, `learning 0004` — qaytarilmaydi).
- Fan sinflari (`Subject.grades`, `ArrayField(SmallInteger)`, tartiblangan, 1..11, kamida 1 ta; migratsiya 0012 mavjud fanlarni 1..11 bilan to'ldiradi). Kitob (`PdfBook`) fan sinfiga tegishli bo'lishi shart: aks holda 400 `validation_error`, `details.subject = [subject_not_in_grade]` (faqat sinf yoki fan o'zgarganda tekshiriladi). Fan sinfini olib tashlash va shu sinfda fanning kitobi (har qanday status) bo'lsa — 409 `grade_has_books`, `details.conflicts = ["7:3"]` (sinf:soni), kitoblar saqlanadi. Maydon kodlari: `grades_required|grades_invalid|grades_duplicate`. Admin `GET subjects/?grade=N` — shu sinfdagi fanlar. Ochiq `pdf-books/subjects/` kitobi bor fanlarni (sinf bo'yicha) va `grades` ni qaytaradi.
- Dev demo: `python manage.py seed_demo_books [--reset]` — faqat DEBUG, `seed_subjects` + 12 ta demo kitob (3 tasida muqova); `description == "demo-seed"` bilan topiladi.
- Fanlar: `python manage.py seed_subjects` — asosiy maktab fanlari (`management/commands/seed_subjects.py`, ro'yxat shu faylda);
  idempotent, mavjud fanga tegmaydi (admin tahriri, sinflar ham, saqlanadi); `--force` mavjud fanlarning sinflarini `GRADES` ro'yxatiga qaytaradi. Admin `/api/v1/admin/subjects/` orqali ham boshqaradi.
- Tavsif va mundarija (M13): `PdfBook.description` (≤ 2000) va `PdfBookChapter` (`book`, `parent?`, `title` ≤ 200, `page` ≥ 1, `order`; 2 daraja). Admin serializer `chapters` ni to'liq almashtiradi (`pdf_services.replace_chapters`), xato kodlari `chapter_page_exceeds` (fayl yuklangan bo'lsa bet ≤ `page_count`), `chapter_page_invalid`, `chapter_title_required`, `chapter_title_too_long`, `chapters_too_many`. Ochiq `pdf-books/{id}/` `description` va `chapters` qaytaradi (ro'yxatda yo'q).
- Ochiq API (`urls.py`): faqat `pdf-books/*` (`pdf_views.py`); `AllowAny`, kesh `cache.public_cached` (Redis, `content:version`
  `signals.py` da Subject/PdfBook o'zgarganda almashadi). `is_staff(user)` hamma statusni ko'radi (`private, no-store`).
- `views.py` — faqat umumiy yordamchilar (`PublicView`, `_int_param`, `GRADE_PARAM`).

## `apps/learning`

- Modellar: `PdfReadProgress` (unique `user+pdf_book`, `last_page`, `client_updated_at`, `read_status` in_progress|read, `first_opened_at`, `read_at`),
  `PdfBookmark` (unique `user+pdf_book`) va `StudyGoal` (title, `pdf_book?`, `due_date?`, `done_at`; foydalanuvchiga 100 tagacha).
  Hammasi login talab qiladi (`/api/v1/me/`): `pdf-progress/`, `pdf-progress/{id}/` (PUT idempotent), `pdf-bookmarks/`,
  `pdf-bookmarks/{id}/` (PUT/DELETE idempotent), `library/` (oxirgi ochilganlar + saqlanganlar soni), `merge-guest-data/`,
  `events/` (`book_opened|book_read`), `recent/` (20 ta), `goals/[{id}/]` (CRUD; begonaniki 404), `dashboard/`, `results/`,
  `teacher/dashboard/` (`IsRole("teacher")`). "Oxirgi ochilganlar" alohida model emas — `PdfReadProgress.updated_at` bo'yicha.
- `services/pdf.py`: ko'rinish (`resolve_pdf_book` = ochiq API qoidasi), `apply_pdf_progress` (qat'iy yangiroq mijoz vaqti
  yutadi), xatcho'p qo'shish/olib tashlash, `library`. `services/merge.py`: mehmon sahifalari va xatcho'plari (har ro'yxat 500 tagacha;
  ko'rinmaydigan/yo'q kitob `failed` ga tushadi). Kontrakt: `contracts/fixtures/merge-pdf-progress.json` (backend va frontend).
- "O'qilgan" holati monoton (`services/pdf.mark_read`): oxirgi betga yetgan yozuv (eskirgan bo'lsa ham) ko'taradi, hech qachon pasaytirmaydi;
  umumiy kontrakt `contracts/fixtures/merge-pdf-read-status.json`. `services/review.py` — "takrorlash kerak" (boshlangan, tugatilmagan,
  `REVIEW_AFTER_DAYS` kun ochilmagan); `services/dashboard.py` — bosh sahifa/natijalar/ustoz yig'masi; `services/events.py`, `services/goals.py`.
- Egalik: queryset'lar `user=request.user` bilan. `delete_account` o'qish ma'lumotlarini (rejalar ham) o'chiradi, `export_data` `learning.pdf_progress`,
  `learning.pdf_bookmarks` va `learning.goals` ni beradi.
- Testlar: `apps/learning/tests/` (`conftest.py` — `api`, `other_api`; `Catalog` — `apps/content/tests/conftest.py`).

## `apps/support`

- `SupportMessage` (UUID pk): `user?` (SET_NULL), `name`, `email`, `kind` (`question|suggestion|bug|content_error`), `message` (10–2000), `page_url`, `topic`, `user_agent`, `status` (`new|in_progress|resolved|spam`), `staff_note` (faqat admin, API'da yo'q).
- `POST /api/v1/support/` (`AllowAny`, `SupportRateThrottle` — IP bo'yicha, `SUPPORT_THROTTLE_RATE`): kirgan foydalanuvchida `user` va (email berilmasa) email akkauntdan; mehmonda email majburiy. Honeypot (`website` to'ldirilgan) — 201 qaytadi, lekin saqlanmaydi. `spam.is_spam` (ko'p havola, tipik iboralar, takror) — `status=spam` bilan saqlanadi, staff'ga xat ketmaydi. Javob doim `{ok: true}`.
- Yangi (spam bo'lmagan) xabarda `tasks.notify_staff` (Celery, `on_commit`) `SUPPORT_NOTIFY_EMAILS` ga yuboradi; bo'sh bo'lsa hech narsa.
- `GET /api/v1/me/support/` — o'z murojaatlari (paginatsiyalangan, spam ko'rsatilmaydi).

## Admin API

- `/api/v1/admin/` (`admin_urls.py`; view'lar `admin_views.py`, serializer'lar `admin_serializers.py`, mantiq `admin_services.py`): ruxsat
  `IsRole("editor","admin")`, o'chirish faqat `admin`. Resurslar: `subjects` (CRUD; slug yaratishda beriladi va o'zgarmaydi —
  `slug_immutable`; PDF kitobi bor fan o'chirilmaydi — `409 has_dependents`; `pdf_books_count`), `pdf-books` (qarang "PDF darsliklar"),
  `uploads/`, `dashboard/` (`pdf_books` {total, published, draft}, `subjects_count`, yangi xabarlar, oxirgi o'zgarishlar), `users/` (faqat admin).
- `POST uploads/` (multipart `file`, `kind` = cover|image|pdf): hajm `ADMIN_UPLOAD_MAX_IMAGE_BYTES/PDF_BYTES`, tur fayl boshidagi imzo bilan
  (JPEG/PNG/WebP, `%PDF`); xatolar `unsupported_type` (415), `file_too_large` (413), `validation_error` (400).
- Audit: `apps/accounts/audit.py` — `record(actor, action, target_type, target_id, label=, before=, after=, request=)` va `snapshot(instance, fields)`.
- Xato kodlari `fields` darajasida (`details`): `slug_taken`, `slug_immutable`, `invalid_file`.
- Testlar: `apps/content/tests/test_admin_api.py` (ruxsat matritsasi anon/student/teacher/editor/admin, fanlar, yuklash tekshiruvlari, dashboard).

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

## PDF darsliklar

- `PdfBook` (`apps/content/models.py`; `Book` dan alohida): `title`, `grade`, `subject`, `file` (kalit `pdf-books/<uuid>.pdf`, DB'da bayt yo'q), `size_bytes`, `page_count` (pypdf, S3'dan vaqtinchalik faylga oqim bilan), `cover` + `cover_mode` (auto|first_page|custom; `auto` da `cover` bo'sh, ochiq API `cover` faqat boshqa rejimda; almashtirilgan/olib tashlangan eski rasm `on_commit` da saqlashdan o'chiriladi; `cover_required` xatosi), `status` draft|published. Yuklash: `upload-init` → (S3: brauzer presigned multipart PUT; dev: `upload/` multipart) → `upload-complete`; `pending_file` yangi faylni `activate`gacha alohida saqlaydi (almashtirish xatosida eski fayl qoladi). Mantiq: `pdf_services.py`, saqlash/URL: `pdf_storage.py`, admin view: `pdf_admin_views.py`, ochiq: `pdf_views.py`.
- Muqova variantlari (`cover_variants.py`, Pillow): `cover` o'zgarsa admin serializer `on_commit` da Celery `tasks.generate_cover_variants` ni ishga tushiradi — `cover_small` (300px) va `cover_large` (600px) WebP (`covers/<uuid>-300.webp`), nisbat saqlanadi, kichik rasm kattalashtirilmaydi; `auto` rejimda yoki rasm o'qilmasa variantlar bo'sh (ochiq API `cover` ga qaytadi: ro'yxat `cover_small`, detail `cover_small`+`cover_large`, ikkalasi `null` bo'lishi mumkin). Eski variantlar almashtirilganda va kitob o'chirilganda tozalanadi. Mavjud kitoblar uchun: `python manage.py generate_covers --missing-only` (`--dry-run`). Ochiq ro'yxat/detail `language` (uz|ru|en) ham qaytaradi (ustun modelda, qo'shimcha so'rov yo'q).
- Ko'rinish: `visible_pdf_books` — fayli bor va published; staff hammasini, `SHOW_DRAFTS_PUBLICLY` draft'ni `unverified` bilan. Nashrdan qaytarish va o'chirish faqat admin. O'chirish (`pdf_services.delete_book`): PDF, muqova va tugallanmagan yuklash saqlashdan qat'iy (`storage.delete_strict`) o'chiriladi va qator bilan bir tranzaksiyada; saqlash xatosida `storage_error` (502), kitob va audit saqlanadi. Progress/xatcho'p/mundarija `CASCADE`, `StudyGoal.pdf_book` esa `SET_NULL`. O'qish URL'i qisqa muddatli (`PDF_SIGNED_URL_SECONDS`); dev'da imzolangan token + `file/` (Range).
- Bo'lim prezentatsiyalari (ixtiyoriy PDF slaydlar): `PdfBookChapter.slides_*` (kalit `pdf-slides/<uuid>.pdf`, nom, soni, hajm, `slides_pending_*`; kalit/upload id `TextField`). Mantiq `slides_services.py` (kitob PDF'i bilan bir xil multipart/proxy mexanizmi, hajm chegarasi yo'q), admin: `pdf-books/{id}/chapters/{cid}/slides/{upload-init|upload-complete|upload-abort|upload}/` (editor+admin) va `DELETE .../slides/` (faqat admin); audit `slides_upload|slides_delete` (`pdf_book_slides`). `replace_chapters` bo'limni `id` bo'yicha joyida yangilaydi (prezentatsiya saqlanadi), ro'yxatdan tushgan bo'lim va kitob o'chirilsa prezentatsiya fayllari ham saqlashdan qat'iy o'chiriladi (`storage_error` 502, hech narsa o'zgarmaydi). Ochiq: `GET pdf-books/{id}/` chapters ichida `slides: {page_count, size_bytes} | null`; `GET pdf-books/{id}/chapters/{cid}/slides/` imzolangan URL (dev: `.../slides/file/?token=` + Range). Kitob ko'rinish qoidasi bir xil (draft — staff).
- Kitob URL'i: `PdfBook.slug` (unikal, `9-sinf-algebra`, band bo'lsa `-2`; yaratilganda beriladi va o'zgarmaydi — sinf/fan o'zgarsa frontend to'g'ri sinfga 308 qiladi). Migratsiyalar 0009 (maydonlar) → 0010 (mavjud kitoblar va fan guruhlarini to'ldirish) → 0011 (slug unique). Ochiq API: `pdf-books/by-slug/{slug}/`; ro'yxat/tafsilotda `slug`, `subject_group`; tafsilotda `language` (uz|ru|en) va `allow_download`.
- Yuklab olish: `GET pdf-books/{id}/download/` → `{url, filename, expires_in}` (S3: `ResponseContentDisposition: attachment` bilan imzolangan URL; dev: `file/?token=…&download=<nom>`), `PdfBook.allow_download=False` bo'lsa 403 `download_disabled` (o'qish ochiq qoladi). `download_count` har so'rovda `F()+1` (kesh versiyasiga tegmaydi). Fayl nomi `pdf_storage.download_filename`.
- `PdfReadProgress` (`apps/learning`): oxirgi sahifa; qat'iy yangiroq mijoz vaqti yutadi (idempotent), merge `pdf_progress`.
- `create_admin` (qat'iy, env bo'sh bo'lsa xato) va `ensure_admin` (jim) umumiy mantiq: `accounts/admin_bootstrap.py`.
- Qo'shimcha (M14): `POST /admin/pdf-books/{id}/duplicate/` (qoralama nusxa: tavsif + mundarija, fayl ko'chirilmaydi), `GET pdf-books/search/?q=` (mundarija bo'limlari), `apps/learning` `PdfAnnotation` (`me/pdf-annotations/`, `services/annotations.py`, merge `pdf_annotations`), `content/bot_views.py` — `GET /api/v1/bot/books/` (`BOT_API_TOKEN` bo'sh bo'lsa 404, `X-Bot-Token`).
