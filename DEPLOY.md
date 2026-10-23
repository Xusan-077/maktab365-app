# Deploy

`main` = production. Frontend — **Vercel**, backend (+ worker) — **Railway**, PDF fayllar — **Cloudflare R2**.
Repo'da hech qanday sir yo'q: qiymatlar faqat Vercel/Railway panelida.

## Oqim: main = prod, ish — alohida branch

1. `git switch -c feat/nom` → ish → push → **Pull Request** ochiladi.
2. CI (`.github/workflows/ci.yml`) yashil bo'lishi shart: frontend `typecheck/lint/test/build`, backend `ruff/pytest/migratsiyalar/openapi`, e2e.
3. PR'da Vercel **preview URL** beradi (Preview env'lar bilan). Preview'da `vercel-build` backend kutmaydi.
4. Tekshirilgach PR `main` ga merge qilinadi → Railway (backend, worker) va Vercel (frontend) **o'zlari** deploy qiladi.
5. Deploydan keyin: `make deploy-check FRONTEND_URL=https://<sayt> API_URL=https://<api>` (quyida).

`main` ga to'g'ridan-to'g'ri push qilinmaydi (GitHub → Settings → Branches → `main` uchun "Require a pull request" va "Require status checks").

## Deploy tartibi: avval backend, keyin frontend

| Holat                         | Natija                                                                                                                                       |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Yangi backend + eski frontend | **Xavfsiz**: API faqat qo'shiladi (yangi maydon/endpoint), eski so'rovlar o'zgarmaydi.                                                       |
| Yangi frontend + eski backend | **Xavfli**: yangi forma yangi maydonni yuboradi, eski backend jim e'tiborsiz qoldiradi (masalan, mundarija saqlanmaydi) yoki 404/400 beradi. |

Shuning uchun tartib: **backend → migratsiya → frontend**. Bu qo'lda emas, mexanik ta'minlanadi:

- **Railway pre-deploy** (`backend/railway.json`): yangi image trafik olishdan oldin `scripts/predeploy.sh` — `migrate --noinput`, `seed_subjects` (ikkalasi idempotent: `seed_subjects` mavjud fanlarga tegmaydi). Xato bo'lsa deploy to'xtaydi, **eski versiya ishlashda davom etadi**. Health-check (`/api/v1/health/`) o'tmasa ham yangi versiya almashmaydi.
- **Vercel production build** (`frontend/package.json` → `vercel-build`): `scripts/wait-for-backend.ts` backend `/api/v1/health/` da `version.api_revision >= frontend/backend-revision.json:min` bo'lguncha kutadi (12 daqiqagacha); bo'lmasa build yiqiladi va **eski frontend prod'da qoladi**.
- **`api_revision`** — `backend/apps/core/version.py::API_REVISION`. Frontend yangi API'siz ishlamaydigan bo'lib qolsa, ikkalasini bitta PR'da oshiring (`backend-revision.json:min` ham). Hozir: `2`.
- `frontend/vercel.json` → `ignoreCommand`: faqat backend o'zgargan commit'da production frontend qayta build qilinmaydi.

**Migratsiya qoidasi (expand/contract).** Pre-deploy migratsiya eski kod ishlab turganda ketadi, shuning uchun migratsiya eski kod bilan mos bo'lishi kerak: ustun/jadval **qo'shish** — bir releaseda; o'chirish/nomini o'zgartirish — kod ishlatishni to'xtatgandan **keyingi** releaseda. Hozirgi migratsiyalar (`accounts 0007`, `content 0005`) faqat qo'shadi.

**Rollback.** Railway: Deployments → oldingi deploy → _Rollback_ (migratsiya orqaga qaytmaydi; additive bo'lgani uchun eski kod yangi sxema bilan ishlaydi). Vercel: Deployments → _Instant Rollback_.

## Deploydan keyingi tekshiruv

- Backend: `GET /api/v1/health/` → `{status, checks{database,redis}, version{commit, api_revision, environment}}` (503 — DB/Redis xato).
- Frontend: `GET /api/health` → frontend commit/muhit, backend commit/`api_revision`, `compatible`; hammasi joyida bo'lsa `200 ok`, aks holda `503 degraded` (backend yo'q, eski yoki DB/Redis xato).
- `make deploy-check FRONTEND_URL=… API_URL=…` ikkalasini chaqirib, commit'lar va moslikni chiqaradi.

Commit ko'rinishi uchun platforma o'zgaruvchilari kerak: Railway `RAILWAY_GIT_COMMIT_SHA`, `RAILWAY_ENVIRONMENT_NAME` (avtomatik); Vercel `VERCEL_GIT_COMMIT_SHA`, `VERCEL_ENV` (Settings → Environment Variables → _Automatically expose System Environment Variables_ yoqilgan bo'lsin).

## Railway (backend)

Ikki servis, bitta repo, **Root Directory = `backend`**; ikkalasi ham `Dockerfile` dan build qilinadi.

| Servis   | Config file path               | Start                                                              | Pre-deploy                | Health-check      |
| -------- | ------------------------------ | ------------------------------------------------------------------ | ------------------------- | ----------------- |
| `web`    | `/backend/railway.json`        | Dockerfile CMD: `gunicorn config.wsgi` (`PORT`, `WEB_CONCURRENCY`) | `sh scripts/predeploy.sh` | `/api/v1/health/` |
| `worker` | `/backend/railway.worker.json` | `celery -A config worker -l info`                                  | yo'q                      | yo'q              |

Qo'shimcha servislar: Postgres, Redis (Railway pluginlari). Branch: `main`; **Wait for CI** yoqilgan.

### Railway env (web **va** worker uchun bir xil, "Shared Variables" qulay)

Majburiy:

| O'zgaruvchi                                                                                                               | Qiymat                                                                                |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `DJANGO_SETTINGS_MODULE`                                                                                                  | `config.settings.prod`                                                                |
| `SECRET_KEY`                                                                                                              | uzun tasodifiy (≥ 50 belgi)                                                           |
| `ALLOWED_HOSTS`                                                                                                           | API domeni (`api.maktab365.uz`); `healthcheck.railway.app` kodda avtomatik qo'shiladi |
| `CSRF_TRUSTED_ORIGINS`                                                                                                    | `https://api.maktab365.uz`                                                            |
| `FRONTEND_ORIGINS`                                                                                                        | `https://maktab365.uz` (vergul bilan)                                                 |
| `FRONTEND_URL`                                                                                                            | `https://maktab365.uz` (email havolalari)                                             |
| `DATABASE_URL`, `REDIS_URL`                                                                                               | Railway Postgres/Redis (reference variable)                                           |
| `FORWARDED_IP_SECRET`                                                                                                     | kuchli qiymat; Vercel `BACKEND_FORWARD_SECRET` bilan **bir xil**                      |
| `TRUSTED_PROXY_HOPS`                                                                                                      | `1`                                                                                   |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`                                                                                           | env admin (login formasidan kirish); ikkalasi ham bo'sh bo'lsa o'chiq                 |
| `AWS_STORAGE_BUCKET_NAME`, `AWS_S3_ENDPOINT_URL`, `AWS_S3_REGION_NAME=auto`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | R2                                                                                    |
| `EMAIL_URL`, `DEFAULT_FROM_EMAIL`                                                                                         | SMTP (xat yuborish)                                                                   |

Tavsiya/ixtiyoriy: `AWS_S3_CUSTOM_DOMAIN` (muqova rasmlari), `GOOGLE_CLIENT_ID`, `TELEGRAM_BOT_TOKEN`, `SUPPORT_NOTIFY_EMAILS`, `SENTRY_DSN` (+ `SENTRY_ENVIRONMENT=production`), `WEB_CONCURRENCY` (default 2), `SECURE_SSL_REDIRECT`, `SHOW_DRAFTS_PUBLICLY` (**qo'ymang**), `PDF_BOOK_MAX_BYTES` (ixtiyoriy PDF hajm chegarasi, bayt; **bo'sh yoki 0 = cheksiz**, default cheksiz; multipart bo'laklari katta faylga qarab avtomatik kattalashadi — 10 000 bo'lakgacha), qolganlari — `backend/.env.example`.

## Vercel (frontend)

Project → Settings → General: **Root Directory = `frontend`**, **Production Branch = `main`**. Build buyrug'i avtomatik: `vercel-build`.

| O'zgaruvchi                                | Production                                                                    | Preview                            |
| ------------------------------------------ | ----------------------------------------------------------------------------- | ---------------------------------- |
| `NEXT_PUBLIC_API_MODE`                     | `http`                                                                        | `http`                             |
| `API_URL`                                  | `https://api.maktab365.uz` (**majburiy**: build backend'ni shu orqali kutadi) | staging backend (prod'ni **emas**) |
| `NEXT_PUBLIC_API_URL`                      | `API_URL` bilan bir xil                                                       | —                                  |
| `NEXT_PUBLIC_SITE_URL`                     | `https://maktab365.uz`                                                        | preview URL yoki bo'sh             |
| `AUTH_SECRET`                              | `openssl rand -base64 32`                                                     | alohida qiymat                     |
| `AUTH_URL`                                 | `https://maktab365.uz`                                                        | — (Vercel `trustHost`)             |
| `BACKEND_FORWARD_SECRET`                   | `FORWARDED_IP_SECRET` bilan bir xil                                           | staging bilan bir xil              |
| `TRUSTED_PROXY_HOPS`                       | `1`                                                                           | `1`                                |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth                                                                  | —                                  |
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`        | bot username (`@`siz)                                                         | —                                  |

Preview deploylar prod ma'lumotiga yozmasligi uchun Preview env'ga **staging backend** (Railway'da alohida _environment_) bering; bo'lmasa Preview'da faqat ko'rish uchun foydalaning.

## Qo'lda tekshirish kerak bo'lgan sozlamalar

Repo'dan Vercel/Railway paneli holatini ko'rib bo'lmaydi. Panelda quyidagilarni tekshiring: [Railway] Root Directory, Config file path (web/worker), Branch=`main`, Wait for CI, Postgres/Redis servislari, env jadvali; [Vercel] Root Directory, Production Branch, env jadvali, System Env Variables yoqilgani, Ignored Build Step bo'sh (`vercel.json` ishlatiladi); [R2] CORS (`backend/README.md`).

## Birinchi push'dan oldingi zaxira (backup)

1. **Postgres**: `pg_dump --format=custom "$DATABASE_URL" > maktab365-$(date +%F).dump` (Railway → Postgres → Connect → public URL) va Railway _Backups_ (Pro) yoqilgan bo'lsin. Dump'ni repo'dan tashqarida saqlang.
2. **R2 bucket**: `rclone sync r2:<bucket> ./r2-backup-$(date +%F)` (yoki ikkinchi bucket'ga nusxa).
3. **Env nusxasi**: Railway Variables → _Raw Editor_ → nusxa; Vercel: `vercel env pull .env.backup --environment=production`. Parollar menejerida saqlang, repo'ga qo'shmang.
4. **Qaytish nuqtasi**: Railway va Vercel'dagi hozirgi (ishlayotgan) deploy ID/URL'ni yozib qo'ying (rollback uchun); git: `git tag pre-deploy-$(date +%F) origin/main` (tag'ni push qilish — ruxsatdan keyin).
5. **Migratsiyani sinash**: dump'ni staging/lokal bazaga tiklab `python manage.py migrate` ishlatib ko'ring (hozirgi migratsiyalar faqat qo'shadi).
