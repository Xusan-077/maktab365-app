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

**M3 (email + parol autentifikatsiya):** backend `/api/v1/auth/*` (SimpleJWT: access 15 daq, refresh 30 kun, rotation + blacklist; email tasdiqlash, parol tiklash/almashtirish, throttle va bloklash, xatlar Celery orqali uz/ru/en). Frontend: `/kirish` (Kirish / Ro'yxatdan o'tish tablari), `/parolni-unutdim`, `/parolni-tiklash`, `/email-tasdiqlash`, panelda email tasdiqlash banneri, Sozlamalar → Xavfsizlik. Brauzer backend'ga `/api/backend` (BFF) orqali murojaat qiladi — tokenlar brauzerga chiqmaydi.

**M4 (Google, Telegram, email kodi):** `POST /api/v1/auth/google|telegram|otp/request|otp/verify/` — hammasi bir User'ga `Identity` orqali bog'lanadi va bir xil `{access, refresh, user, is_new}` qaytaradi; `GET/POST/DELETE /me/identities/…`, `POST /me/password/set/`. Provayderlar `backend/apps/accounts/providers/` da (umumiy interfeys `verify(payload) -> ProviderIdentity`; SMS/Eskiz uchun interfeys tayyor). Bog'lash qoidalari va xavfsizlik qarorlari — `backend/README.md`. Frontend: Google `id_token` Auth.js `signIn` callback'ida backend'ga almashtiriladi (Google'ning o'z sessiyasi ishlatilmaydi), Telegram va email kodi — Credentials provayderlar; `/kirish` (Google / Telegram / «Email'ga kod yuborish»), `/kod` (6 katak, qayta yuborish taymeri), Sozlamalar → Xavfsizlik (ulangan usullar, parol o'rnatish). Eski oqim (`NEXT_PUBLIC_BACKEND_AUTH`, rol cookie'si) olib tashlangan.

- Lokal ishga tushirish: `frontend/.env.local` ga `AUTH_SECRET` (va ixtiyoriy `GOOGLE_CLIENT_ID/SECRET`, `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`); backend `.env` ga `GOOGLE_CLIENT_ID`, `TELEGRAM_BOT_TOKEN`; `docker compose up -d` (xatlar `docker compose logs worker` da ko'rinadi — dev'da konsol backend; dev'da email kodini `GET /api/v1/dev/otp/?email=…` ham qaytaradi, faqat `OTP_DEV_INBOX`, prod'da yo'q).
- Telegram: @BotFather da bot oching, `/setdomain` bilan sayt domenini bog'lang (lokal `localhost` widget'da ishlamaydi — tunnel/ngrok domeni kerak); bot username → `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`, token → backend `TELEGRAM_BOT_TOKEN`.
- Google: Cloud Console'da bitta OAuth client; redirect URI `…/api/auth/callback/google`, "Authorized JavaScript origins" ga sayt manzili (Sozlamalar'dagi Google'ni ulash tugmasi uchun). Client ID frontend va backend'da bir xil.
- E2E: `make e2e` (yoki `cd frontend && npx playwright test`; birinchi marta `npx playwright install chromium`).
- Ma'lum cheklovlar: parol almashtirilgach boshqa qurilmalardagi access token o'z muddatigacha (≤15 daq) ishlaydi; refresh single-flight bitta jarayon ichida — bir nechta server instansiyasida bir vaqtdagi refresh'da sessiya kamdan-kam yo'qolishi mumkin. Mijoz IP (throttle/audit): backend `X-Forwarded-For` ga faqat Next serveridan umumiy sir bilan kelganda ishonadi (`FORWARDED_IP_SECRET` = frontend `BACKEND_FORWARD_SECRET`); prod'da ikkalasiga kuchli qiymat bering, proxy ortida bo'lsa `TRUSTED_PROXY_HOPS` ni sozlang.

**Docker portlari:** host'da 5432/6379 band bo'lsa (masalan, lokal Postgres), ildizdagi `.env` ga `POSTGRES_PORT=55432` (yoki `REDIS_PORT`) yozing va `backend/.env` dagi `DATABASE_URL` portini mos qiling. Konteynerlar ichida portlar o'zgarmaydi.
