# Maktab365

1–11-sinf darsliklari mavzular bo'yicha, bepul, o'quvchi va o'qituvchi uchun platforma.

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

- **Vercel:** Project Settings → General → **Root Directory = `frontend`**. Build/Install buyruqlari standart (`npm install`, `npm run build`).
- Muhit o'zgaruvchilari `frontend/.env.example` da keltirilgan.

**M2 (foydalanuvchi va profil):** backend `/api/v1/me/*` (profil, onboarding, rol, o'chirish, eksport) va frontend `HttpApi` metodlari tayyor. Auth.js (Google) hali backend tokenlariga ulanmagan — http rejimidagi profil oqimi M3 (JWT) dan keyin to'liq ishlaydi; hozir u backend testlari (`cd backend && uv run pytest`) va mock rejimi bilan qoplangan.

**M3 (email + parol autentifikatsiya):** backend `/api/v1/auth/*` (SimpleJWT: access 15 daq, refresh 30 kun, rotation + blacklist; email tasdiqlash, parol tiklash/almashtirish, throttle va bloklash, xatlar Celery orqali uz/ru/en). Frontend: `NEXT_PUBLIC_BACKEND_AUTH=true` bilan `/kirish` (Kirish / Ro'yxatdan o'tish tablari), `/parolni-unutdim`, `/parolni-tiklash`, `/email-tasdiqlash`, panelda email tasdiqlash banneri, Sozlamalar → Xavfsizlik. Brauzer backend'ga `/api/backend` (BFF) orqali murojaat qiladi — tokenlar brauzerga chiqmaydi. Google — hozircha eski oqim (M4 da backend bilan ulanadi).

- Yangi oqimni lokal yoqish: `frontend/.env.local` ga `NEXT_PUBLIC_BACKEND_AUTH=true` va `AUTH_SECRET`; `docker compose up -d` (xatlar `docker compose logs worker` da ko'rinadi — dev'da konsol backend).
- E2E: `make e2e` (yoki `cd frontend && npx playwright test`; birinchi marta `npx playwright install chromium`).
- Ma'lum cheklovlar: parol almashtirilgach boshqa qurilmalardagi access token o'z muddatigacha (≤15 daq) ishlaydi; refresh single-flight bitta jarayon ichida — bir nechta server instansiyasida bir vaqtdagi refresh'da sessiya kamdan-kam yo'qolishi mumkin. Mijoz IP (throttle/audit): backend `X-Forwarded-For` ga faqat Next serveridan umumiy sir bilan kelganda ishonadi (`FORWARDED_IP_SECRET` = frontend `BACKEND_FORWARD_SECRET`); prod'da ikkalasiga kuchli qiymat bering, proxy ortida bo'lsa `TRUSTED_PROXY_HOPS` ni sozlang.

**M6 (kontent modellari + import):** backend `apps/content` — `Subject → Book → Chapter → Topic` (+ `TopicRevision`, oxirgi 50 ta), mavzu bloklari pydantic sxemasi (`apps/content/schemas.py`) bilan tekshiriladi va frontend yup sxemasi bilan 1:1 mos. Ikki tomon ham ildizdagi [`contracts/fixtures/`](contracts/fixtures) namunalari (`topic-valid.json`, `topic-invalid-*.json`, kutilgan xato yo'llari — `expected.json`) bilan test qilinadi: yangi qoida qo'shilsa, avval fixture, keyin ikkala sxema. Frontend kontentini bazaga yuklash:

```bash
cd backend && uv run python manage.py import_content ../frontend/src/content [--dry-run]
# yoki frontend/ dan: npm run content:import
```

Import idempotent (slug bo'yicha upsert, hammasi bitta tranzaksiyada), bazadagi status faylnikidan yuqori bo'lsa pasaymaydi. Fayllar (muqova, PDF) dev'da `backend/media/`, prod'da S3-mos saqlash (`AWS_STORAGE_BUCKET_NAME`, qarang `backend/.env.example`). Frontend hali mock kontentda — ko'rinadigan o'zgarish yo'q.

**M7 (ochiq kontent API + qidiruv + frontend):** backend (loginsiz, faqat published): `GET /api/v1/grades/`, `subjects/?grade=`, `books/?grade=&subject=&q=&topics_ready=` (sahifalangan), `books/{slug}/` (boblar + mavzular, bloklarsiz), `books/{book}/topics/{topic}/` (bloklar, oldingi/keyingi, breadcrumb), `search/?q=&grade=&subject=&book=` (PostgreSQL full-text, kirill so'rov lotinga o'giriladi, snippet). Javoblar Redis'da (kontent versiyasiga bog'liq kalit; kontent o'zgarsa tozalanadi), `ETag`/`If-None-Match`, `Cache-Control: public, max-age=60`. Staff (editor/admin) draft/reviewed mavzularni ham ko'radi (keshlanmaydi); ochiq API'da `SHOW_DRAFTS_PUBLICLY=true` bo'lsa ular `unverified: true` bilan chiqadi (frontend "Tekshiruvdan o'tmagan" belgisi). Default: dev'da (`settings.dev`, docker-compose, e2e) `true`, boshqa muhitda va prod'da `false`. **Prod'da draft kontentni ochiq ko'rsatish — ongli qaror, faqat `SHOW_DRAFTS_PUBLICLY=true` env bilan yoqiladi.**

- Frontend: `NEXT_PUBLIC_API_MODE=http` da katalog, fan, kitob, mavzu, bosh sahifa va qidiruv backend'dan (`HttpApi`); progress/xatcho'p/maqsad/fikr hali mock'da. Server tomonda `"use cache"` (ISR: 5 daqiqa, teg `content`); `npm run build` backend'siz ham o'tadi: `http` rejimida `generateStaticParams` slug'larni `frontend/src/content` fayllaridan oladi (`import_content` bilan bir manba), backend'ga murojaat qilmaydi; backend build vaqtida o'chiq bo'lsa sahifalar "teshik" bo'lib qoladi va birinchi so'rovda on-demand ISR bilan chiqadi (fayllarda yo'q yangi mavzular ham shunday). Backend xatosi — qayta urinish tugmali xato holati.
- Kontentni yuklash: `npm run content:import` (yoki `cd backend && uv run python manage.py import_content ../frontend/src/content`); e2e `global-setup.ts` compose backend'da `import_content /content` ni o'zi bajaradi (`E2E_SKIP_IMPORT=1` — o'tkazib yuborish, `E2E_API_URL`, `E2E_PORT`).
- Umumiy shartnoma vektorlari: `contracts/fixtures/translit.json` (kirill→lotin; backend `apps/core/translit.py`, frontend `lib/i18n/translit.ts`).

**Docker portlari:** host'da 5432/6379 band bo'lsa (masalan, lokal Postgres), ildizdagi `.env` ga `POSTGRES_PORT=55432` (yoki `REDIS_PORT`) yozing va `backend/.env` dagi `DATABASE_URL` portini mos qiling. Konteynerlar ichida portlar o'zgarmaydi.

**M9 (yordam va aloqa):** backend `apps/support` — `POST /api/v1/support/` (mehmon ham yuboradi; IP bo'yicha 5/soat, honeypot, uzunlik limiti, oddiy spam filtri, yangi xabar staff'ga Celery orqali `SUPPORT_NOTIFY_EMAILS` ga yuboriladi) va `GET /api/v1/me/support/` (o'z murojaatlari va holati). Admin'da `SupportMessage` holati (`new/in_progress/resolved/spam`) va `staff_note` boshqariladi. Frontend: marketing `/yordam` ("Yordam va aloqa" — FAQ + forma), panel `/kabinet/yordam` va `/ustoz/yordam` (forma + "Mening xabarlarim"), mavzu sahifasida "Xato topdingizmi?" dialogi (mavzu va sahifa manzili avtomatik qo'shiladi). Murojaat metodlari (`sendSupport`, `getMySupport`) `NEXT_PUBLIC_BACKEND_AUTH=true` da mock rejimida ham haqiqiy backend'ga boradi. E2E: `frontend/e2e/support.spec.ts`.
