# Maktab365

1–11-sinf darsliklari (PDF) onlayn, bepul, o'quvchi va o'qituvchi uchun platforma.

## Struktura

- [`frontend/`](frontend/README.md) — Next.js ilovasi.
- [`backend/`](backend/README.md) — Django + DRF API (poydevor tayyor: `apps/core`, health, OpenAPI).
- [`brand/`](brand/README.md) — logo to'plami.
- [`CLAUDE.md`](CLAUDE.md) — monorepo qoidalari va Definition of Done.

## Ishga tushirish

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev        # http://localhost:3000
```

Yoki ildizdan: `make dev`. Boshqa buyruqlar: `make test`, `make lint`, `make schema`, `make types`, `make e2e`; `make migrate` — migratsiyalar. `make dev` Docker (postgres, redis, backend, worker) va frontend'ni ko'taradi; tekshiruv: http://localhost:3000/uz/dev/api-status backend "ok" ko'rsatadi, `make smoke` shuni avtomatik tekshiradi; `make e2e` — Playwright (auth oqimi).

## Deploy

- **To'liq qo'llanma: [`DEPLOY.md`](DEPLOY.md)** — oqim (main = prod, PR → preview), tartib (backend → frontend), env ro'yxati, qo'lda sozlamalar va zaxira.
- **Vercel:** Project Settings → General → **Root Directory = `frontend`**, Production Branch = `main`. Build buyrug'i avtomatik (`vercel-build`: avval backend tayyorligini kutadi, keyin `next build`).
- **Railway:** servis Root Directory = `backend`; `backend/railway.json` (web: pre-deploy `migrate` + `seed_subjects`, health-check `/api/v1/health/`) va `backend/railway.worker.json` (Celery).
- **Tekshiruv:** `GET /api/v1/health/` (backend) va `GET /api/health` (frontend) commit va `api_revision` ni ko'rsatadi; `make deploy-check`.
- Muhit o'zgaruvchilari `frontend/.env.example` da keltirilgan.

**M2 (foydalanuvchi va profil):** backend `/api/v1/me/*` (profil, onboarding, rol, o'chirish, eksport) va frontend `HttpApi` metodlari tayyor. Auth.js (Google) hali backend tokenlariga ulanmagan — http rejimidagi profil oqimi M3 (JWT) dan keyin to'liq ishlaydi; hozir u backend testlari (`cd backend && uv run pytest`) va mock rejimi bilan qoplangan.

**M3 (email + parol autentifikatsiya):** backend `/api/v1/auth/*` (SimpleJWT: access 15 daq, refresh 30 kun, rotation + blacklist; email tasdiqlash, parol tiklash/almashtirish, throttle va bloklash, xatlar Celery orqali uz/ru/en). Frontend: `/kirish` (Kirish / Ro'yxatdan o'tish tablari), `/parolni-unutdim`, `/parolni-tiklash`, `/email-tasdiqlash`, panelda email tasdiqlash banneri, Sozlamalar → Xavfsizlik. Brauzer backend'ga `/api/backend` (BFF) orqali murojaat qiladi — tokenlar brauzerga chiqmaydi.

**M4 (Google, Telegram, email kodi):** `POST /api/v1/auth/google|telegram|otp/request|otp/verify/` — hammasi bir User'ga `Identity` orqali bog'lanadi va bir xil `{access, refresh, user, is_new}` qaytaradi; `GET/POST/DELETE /me/identities/…`, `POST /me/password/set/`. Provayderlar `backend/apps/accounts/providers/` da (umumiy interfeys `verify(payload) -> ProviderIdentity`; SMS/Eskiz uchun interfeys tayyor). Bog'lash qoidalari va xavfsizlik qarorlari — `backend/README.md`. Frontend: Google `id_token` Auth.js `signIn` callback'ida backend'ga almashtiriladi (Google'ning o'z sessiyasi ishlatilmaydi), Telegram va email kodi — Credentials provayderlar; `/kirish` (Google / Telegram / «Email'ga kod yuborish»), `/kod` (6 katak, qayta yuborish taymeri), Sozlamalar → Xavfsizlik (ulangan usullar, parol o'rnatish). Eski oqim (`NEXT_PUBLIC_BACKEND_AUTH`, rol cookie'si) olib tashlangan.

- Lokal ishga tushirish: `frontend/.env.local` ga `AUTH_SECRET` (va ixtiyoriy `GOOGLE_CLIENT_ID/SECRET`, `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`); backend `.env` ga `GOOGLE_CLIENT_ID`, `TELEGRAM_BOT_TOKEN`; `docker compose up -d` (xatlar `docker compose logs worker` da ko'rinadi — dev'da konsol backend; dev'da email kodini `GET /api/v1/dev/otp/?email=…` ham qaytaradi, faqat `OTP_DEV_INBOX`, prod'da yo'q).
- Telegram: @BotFather da bot oching, `/setdomain` bilan sayt domenini bog'lang (lokal `localhost` widget'da ishlamaydi — tunnel/ngrok domeni kerak); bot username → `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`, token → backend `TELEGRAM_BOT_TOKEN`.
- Google: Cloud Console'da bitta OAuth client; redirect URI `…/api/auth/callback/google`, "Authorized JavaScript origins" ga sayt manzili (Sozlamalar'dagi Google'ni ulash tugmasi uchun). Client ID frontend va backend'da bir xil.
- E2E: `make e2e` (yoki `cd frontend && npx playwright test`; birinchi marta `npx playwright install chromium`).
- Ma'lum cheklovlar: parol almashtirilgach boshqa qurilmalardagi access token o'z muddatigacha (≤15 daq) ishlaydi; refresh single-flight bitta jarayon ichida — bir nechta server instansiyasida bir vaqtdagi refresh'da sessiya kamdan-kam yo'qolishi mumkin. Mijoz IP (throttle/audit): backend `X-Forwarded-For` ga faqat Next serveridan umumiy sir bilan kelganda ishonadi (`FORWARDED_IP_SECRET` = frontend `BACKEND_FORWARD_SECRET`); prod'da ikkalasiga kuchli qiymat bering, proxy ortida bo'lsa `TRUSTED_PROXY_HOPS` ni sozlang.

**Docker portlari:** host'da 5432/6379 band bo'lsa (masalan, lokal Postgres), ildizdagi `.env` ga `POSTGRES_PORT=55432` (yoki `REDIS_PORT`) yozing va `backend/.env` dagi `DATABASE_URL` portini mos qiling. Konteynerlar ichida portlar o'zgarmaydi.

**M9 (yordam va aloqa):** backend `apps/support` — `POST /api/v1/support/` (mehmon ham yuboradi; IP bo'yicha 5/soat, honeypot, uzunlik limiti, oddiy spam filtri, yangi xabar staff'ga Celery orqali `SUPPORT_NOTIFY_EMAILS` ga yuboriladi) va `GET /api/v1/me/support/` (o'z murojaatlari va holati). Admin'da `SupportMessage` holati (`new/in_progress/resolved/spam`) va `staff_note` boshqariladi. Frontend: marketing `/yordam` ("Yordam va aloqa" — FAQ + forma), panel `/kabinet/yordam` va `/ustoz/yordam` (forma + "Mening xabarlarim"), mavzu sahifasida "Xato topdingizmi?" dialogi (mavzu va sahifa manzili avtomatik qo'shiladi). Murojaat metodlari (`sendSupport`, `getMySupport`) `NEXT_PUBLIC_BACKEND_AUTH=true` da mock rejimida ham haqiqiy backend'ga boradi. E2E: `frontend/e2e/support.spec.ts`.

**M11 (PDF darsliklar):** admin `/admin/kitoblar` — sinf → fan → nom va PDF (progress bilan yuklash, muqova 1-sahifadan adminning brauzerida pdf.js bilan), tahrirlash, faylni almashtirish, nashr/yashirish (yashirish va o'chirish faqat admin), audit. Ochiq: `/darsliklar` (sinf → fan → kitoblar) va `/darsliklar/<id>?page=N` (sahifa-sahifa o'qish: ◀ ▶, "12 / 240" maydoni, ←/→, mobilda swipe). Backend: `PdfBook` (`apps/content`), `PdfReadProgress` (`apps/learning`); admin `/api/v1/admin/pdf-books/…`, ochiq `/api/v1/pdf-books/…`, `me/pdf-progress/`; mehmon pozitsiyasi `merge-guest-data/` (`pdf_progress`) orqali birlashadi (qoida: `contracts/fixtures/merge-pdf-progress.json`).

- **Saqlash:** prod'da S3-mos (Cloudflare R2): brauzer faylni multipart bilan **to'g'ridan-to'g'ri** R2'ga yuklaydi va imzolangan URL (`PDF_SIGNED_URL_SECONDS`, default 15 daq) bilan Range orqali o'qiydi — baytlar Vercel BFF'dan o'tmaydi (4.5 MB cheklov). Dev'da (`AWS_STORAGE_BUCKET_NAME` bo'sh) fayl backend orqali (`media/`, Range qo'llab-quvvatlanadi, BFF orqali).
- **Admin:** `python manage.py create_admin` (`ADMIN_EMAIL`/`ADMIN_PASSWORD` env'dan; bo'sh bo'lsa xato; idempotent). Qiymatlar kodda/Git'da yo'q. Shu juftlik bilan login formasidan ham kiriladi (M13).
- **Env/R2 CORS:** `backend/.env.example` (PDF_* kalitlari) va `backend/README.md`.

**M13 (env admin, foydalanuvchilar boshqaruvi, tavsif va mundarija):**

- **Env admin:** Railway'dagi `ADMIN_EMAIL`/`ADMIN_PASSWORD` bilan oddiy login formasidan kirilsa, admin akkaunt bazada
  bo'lmasa avtomatik yaratiladi (`role=admin`, `is_env_admin`) va foydalanuvchi to'g'ridan-to'g'ri `/admin` ga tushadi.
  Email kichik harfga keltiriladi, parol `hmac.compare_digest` bilan solishtiriladi; env bo'sh bo'lsa bu yo'l butunlay o'chiq.
  Bu email uchun faqat env paroli o'tadi: Railway'da parol almashsa, keyingi kirishda xesh yangilanadi, eskisi ishlamaydi.
  Mavjud 429 bloklash va throttle shu yo'lga ham ishlaydi; xato doim bir xil (`invalid_credentials`). Env admin emailiga
  ro'yxatdan o'tib bo'lmaydi. Parol hech qayerga (log, `AuthEvent`, `AuditLog`, javob) yozilmaydi.
- **Admin faqat admin panelda:** `src/proxy.ts` (`lib/auth/redirects.ts`) admin rolidagi foydalanuvchini `/darsliklar`,
  `/kabinet`, `/ustoz` va boshqa hamma sahifadan `/admin` ga qaytaradi; yon panelda «saytga o'tish» yo'q, faqat «Chiqish».
  Backend ham o'quvchi API'larida (`/me/library/`, `pdf-progress`, `goals`…) admin uchun 403 beradi (`IsLearner`).
- **Foydalanuvchilar** (`/admin/foydalanuvchilar`, `/api/v1/admin/users/`, faqat admin): jadval (ism, email, rol, sana, holat),
  qidiruv, rol/holat filtri, sahifalash; qo'shish (parol yoki bir martalik vaqtinchalik parol), rolni o'zgartirish,
  bloklash/blokdan chiqarish (sessiyalar tugatiladi), o'chirish — har amal tasdiqlanadi. Himoyalar backend'da:
  `env_admin_protected`, `self_action_forbidden`, `last_admin`. Hammasi `AuditLog` ga yoziladi (parolsiz).
- **Tavsif va mundarija:** `PdfBook.description` (≤ 2000) va `PdfBookChapter` (sarlavha, PDF beti ≥ 1, tartib, 2 darajali).
  Wizard'da nom + PDF dan keyin ixtiyoriy «Tavsif va mundarija» qadami (qator qo'shish/o'chirish/surish, «Ommaviy kiritish»:
  `1. Kirish ... 5`); tahrirlash sahifasida ham. Bet PDF betlaridan oshsa `chapter_page_exceeds`. Ochiq
  `GET /pdf-books/{id}/` `description` va `chapters` beradi; o'qish oynasida «Mundarija» paneli (`?page=N`, joriy bo'lim
  ajratiladi) va qisqa tavsif («Batafsil»). E2E: `frontend/e2e/admin-users.spec.ts`, `pdf-books.spec.ts`.

**M12 (faqat PDF darsliklar):** mavzu tizimi (kitob/bob/mavzu, mashqlar, progress, natijalar, maqsadlar,
`import_content`) olib tashlandi; platformada admin yuklagan PDF darsliklar (`PdfBook`) qoladi.

- **Ochiq:** `/darsliklar` — sinf → fan → kitoblar (muqova, nom bo'yicha qidiruv, faqat nashr qilinganlar);
  o'qish `/darsliklar/{id}?page=N`. Bosh sahifa va Ctrl+K qidiruvi shu katalogdan foydalanadi.
  API: `GET /api/v1/pdf-books/`, `pdf-books/subjects/`, `pdf-books/{id}/`, `file-url/`.
- **Kabinet (o'quvchi) va ustoz paneli:** bosh sahifada "Davom ettirish" (oxirgi ochilgan kitob va bet) va
  oxirgi ochilganlar (`GET /me/library/`), "Saqlanganlar" (`GET|PUT|DELETE /me/pdf-bookmarks/{id}/`),
  oxirgi sahifa (`/me/pdf-progress/`). Mehmonning sahifalari va saqlangan kitoblari brauzerda turadi va
  kirgach `POST /me/merge-guest-data/` bilan akkauntga qo'shiladi (eski `maktab365-guest*` kalitlari bir marta tozalanadi).
- **Admin:** `/admin/kitoblar` (PDF kitoblar), `/admin/fanlar` (fanlar: qo'shish, nom, o'chirish — PDF kitobi bor fan
  o'chmaydi), `/admin/foydalanuvchilar`. Fanlar: `python manage.py seed_subjects` (19 ta asosiy fan; idempotent,
  mavjudiga tegmaydi).
- **Eski manzillar** 308 bilan yo'naltiriladi (`frontend/next.config.ts`): `/pdf-kitoblar*` → `/darsliklar*`,
  `/fanlar*`, `/darsliklar/{slug}[/{mavzu}]`, panel ichidagi eski bo'limlar → `/darsliklar`, `/admin/pdf-kitoblar*` →
  `/admin/kitoblar*`.
- **Migratsiyalar qaytarilmaydi:** `content 0004` va `learning 0004` mavzu tizimi jadvallarini (Book, Chapter, Topic,
  TopicRevision, TopicProgress, eski Bookmark, StudyGoal, RecentView) o'chiradi. Prod'da `migrate` dan oldin Postgres
  zaxirasini oling.
- E2E lokal backend bilan: `E2E_MANAGE_CWD=<backend papkasi> E2E_API_URL=http://localhost:8001 npx playwright test`;
  backend `config.settings.dev`, `CELERY_TASK_ALWAYS_EAGER=true`, `FORWARDED_IP_SECRET=dev-forward-secret` va
  yuqoriroq `AUTH_THROTTLE_RATE` / `SUPPORT_THROTTLE_RATE` bilan (alohida baza, masalan `maktab365_e2e`). Global
  setup `seed_subjects` ni o'zi bajaradi (`E2E_SKIP_SEED=1` — o'tkazib yuborish).

**M8 (o'qish jarayoni, PDF darsliklar uchun):** mavzu tizimi olib tashlangani uchun M8 matni (mavzu/mashq progressi)
PDF kitoblarga moslab bajarildi. Backend `apps/learning` (hammasi login talab qiladi, `/api/v1/me/`):

- **O'qilgan holati:** `PdfReadProgress.read_status` (`in_progress|read`, monoton — bir marta `read` bo'lsa pasaymaydi),
  `first_opened_at`, `read_at`. Kitobning oxirgi betiga yetish (PUT yoki mehmon merge'i) yoki `book_read` hodisasi "o'qilgan" qiladi.
  `PUT pdf-progress/{id}/` sahifa uchun idempotent ("qat'iy yangiroq mijoz vaqti yutadi"), holat sahifadan mustaqil.
- **Hodisalar:** `POST events/` (`book_opened` — kitobni "oxirgi ochilganlar"ga qo'yadi, `book_read`), `GET recent/` (oxirgi 20 ta).
- **Rejalar:** `StudyGoal` — `GET|POST goals/`, `GET|PATCH|DELETE goals/{id}/` (`done` idempotent; kitob va muddat ixtiyoriy; 100 tagacha).
- **Bosh sahifa/natijalar:** `GET dashboard/` (davom ettirish, fanlarim, takrorlash kerak, haftalik natija, saqlanganlar, ochiq rejalar),
  `GET results/` (o'qilgan / jarayondagi / takrorlash kerak), `GET teacher/dashboard/` (faqat `teacher`: dashboard + dars beradigan sinflar
  bo'yicha qamrov). "Takrorlash kerak" qoidasi `services/review.py`: boshlangan, tugatilmagan kitob 7 kun ochilmasa.
- **Merge:** `POST merge-guest-data/` o'zgarmadi (idempotent, 500 limit); "o'qilgan" qoidasi ham umumiy kontraktda
  (`contracts/fixtures/merge-pdf-read-status.json`, backend va frontend testlari).
- Mashq/"mashqdan o'tdim" va `last_block_id` PDF'da yo'q (mashq yo'q; "davom ettirish" oxirgi betga — `?page=N` — olib boradi).

Frontend: kabinet `/kabinet` (dashboard), `/kabinet/fanlar`, `/kabinet/natijalar`, `/kabinet/saqlanganlar`; ustoz `/ustoz`
(teacher dashboard). Katalog/saqlanganlardagi "O'qilgan" belgisi serverdan (mehmonda oxirgi betga yetilganidan).
Yozuvlar (sahifa, xatcho'p, hodisa) `lib/offline/write-queue.ts` orqali: TanStack Query optimistic update, internet yo'q/sekin bo'lsa
brauzerda (`maktab365-writes:<user>`) navbatga tushadi va internet qaytganda/taymerda qayta yuboriladi, 4xx bo'lsa o'zgarish qaytariladi.
Mehmon ma'lumoti kirgach merge qilinadi; xatoda saqlanadi va oshib boruvchi oraliq bilan qayta uriniladi. E2E: `frontend/e2e/learning.spec.ts`.
Rejalar (goals) navbatsiz: optimistic + rollback, offline'da xato ko'rsatiladi.

