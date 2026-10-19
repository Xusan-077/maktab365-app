# Maktab365

1–11-sinf darsliklari mavzular bo'yicha, bepul, o'quvchi va o'qituvchi uchun platforma.

## Struktura

- [`frontend/`](frontend/README.md) — Next.js ilovasi.
- [`backend/`](backend/README.md) — Django + DRF API (hozircha sozlanmagan).
- [`brand/`](brand/README.md) — logo to'plami.
- [`CLAUDE.md`](CLAUDE.md) — monorepo qoidalari va Definition of Done.

## Ishga tushirish

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev        # http://localhost:3000
```

Yoki ildizdan: `make dev`. Boshqa buyruqlar: `make test`, `make lint`, `make schema`, `make types`, `make e2e` (backend sozlanmaguncha tegishlilari "backend hali sozlanmagan" deb xabar beradi).

## Deploy

- **Vercel:** Project Settings → General → **Root Directory = `frontend`**. Build/Install buyruqlari standart (`npm install`, `npm run build`).
- Muhit o'zgaruvchilari `frontend/.env.example` da keltirilgan.
