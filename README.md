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

**Docker portlari:** host'da 5432/6379 band bo'lsa (masalan, lokal Postgres), ildizdagi `.env` ga `POSTGRES_PORT=55432` (yoki `REDIS_PORT`) yozing va `backend/.env` dagi `DATABASE_URL` portini mos qiling. Konteynerlar ichida portlar o'zgarmaydi.

**M9 (yordam va aloqa):** backend `apps/support` — `POST /api/v1/support/` (mehmon ham yuboradi; IP bo'yicha 5/soat, honeypot, uzunlik limiti, oddiy spam filtri, yangi xabar staff'ga Celery orqali `SUPPORT_NOTIFY_EMAILS` ga yuboriladi) va `GET /api/v1/me/support/` (o'z murojaatlari va holati). Admin'da `SupportMessage` holati (`new/in_progress/resolved/spam`) va `staff_note` boshqariladi. Frontend: marketing `/yordam` ("Yordam va aloqa" — FAQ + forma), panel `/kabinet/yordam` va `/ustoz/yordam` (forma + "Mening xabarlarim"), mavzu sahifasida "Xato topdingizmi?" dialogi (mavzu va sahifa manzili avtomatik qo'shiladi). Murojaat metodlari (`sendSupport`, `getMySupport`) `NEXT_PUBLIC_BACKEND_AUTH=true` da mock rejimida ham haqiqiy backend'ga boradi. E2E: `frontend/e2e/support.spec.ts`.
