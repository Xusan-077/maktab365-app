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

Yoki ildizdan: `make dev`. Boshqa buyruqlar: `make test`, `make lint`, `make schema`, `make types`, `make e2e`; `make migrate` — migratsiyalar. `make dev` Docker (postgres, redis, backend, worker) va frontend'ni ko'taradi; tekshiruv: http://localhost:3000/uz/dev/api-status backend "ok" ko'rsatadi, `make smoke` shuni avtomatik tekshiradi; `make e2e` (Playwright) keyingi bosqichda.

## Deploy

- **Vercel:** Project Settings → General → **Root Directory = `frontend`**. Build/Install buyruqlari standart (`npm install`, `npm run build`).
- Muhit o'zgaruvchilari `frontend/.env.example` da keltirilgan.

**M2 (foydalanuvchi va profil):** backend `/api/v1/me/*` (profil, onboarding, rol, o'chirish, eksport) va frontend `HttpApi` metodlari tayyor. Auth.js (Google) hali backend tokenlariga ulanmagan — http rejimidagi profil oqimi M3 (JWT) dan keyin to'liq ishlaydi; hozir u backend testlari (`cd backend && uv run pytest`) va mock rejimi bilan qoplangan.

**Docker portlari:** host'da 5432/6379 band bo'lsa (masalan, lokal Postgres), ildizdagi `.env` ga `POSTGRES_PORT=55432` (yoki `REDIS_PORT`) yozing va `backend/.env` dagi `DATABASE_URL` portini mos qiling. Konteynerlar ichida portlar o'zgarmaydi.
