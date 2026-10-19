# Maktab365 (monorepo)

1–11-sinf darsliklari mavzular bo'yicha, bepul, o'quvchi va o'qituvchi uchun platforma.

## Xarita

| Papka | Vazifasi |
| --- | --- |
| `frontend/` | Next.js (App Router) ilovasi — Vercel'ga deploy (Root Directory = `frontend`). |
| `backend/` | Django + DRF API (keyingi bosqichda). `backend/openapi.yaml` — API shartnomasi. |
| `brand/` | Logo to'plami (manba fayllar). Saytda `frontend/public/` nusxalari ishlatiladi. |
| `.github/workflows/ci.yml` | CI: path filter bilan frontend va backend job'lari. |
| `Makefile` | Ikkala tomon uchun umumiy buyruqlar (`make dev/test/lint/schema/types/e2e`). |

`frontend/` va `backend/` ichida ularning o'z `CLAUDE.md` fayli bor — shu papkada ishlaganda o'sha qoidalar amal qiladi (`frontend/CLAUDE.md`, `backend/CLAUDE.md` — backend'niki Django sozlanganda qo'shiladi).

## Shartnoma qoidasi

- `backend/openapi.yaml` — API'ning **yagona manbasi**.
- Frontend API tiplarini **qo'lda yozmaydi**: ular `frontend/src/lib/api/schema.ts` da generatsiya qilinadi.
- API o'zgarsa: `make schema && make types`, natijani commit qiling.

## API konventsiyalari

- Prefiks: `/api/v1`.
- JSON kalitlari `snake_case`.
- Xato formati (tekis, o'ramsiz): `{ "code": "validation_error", "message": "...", "details": { "field_name": ["xabar", ...] } }` (`details` ixtiyoriy — maydon xatolari uchun). `code` — mashina o'qiydigan barqaror kalit, `message` — foydalanuvchiga ko'rsatilmaydi (UI matni i18n orqali).
- `LocalizedText` — `{ uz: string; ru?: string; en?: string }` (`frontend/src/types/i18n.ts`); API tilni tanlamaydi, klient `getLocalized` bilan tanlaydi.

## Jarayonlar bilan ishlash

Jarayonlarni hech qachon nomi bilan (`taskkill /IM python.exe` va h.k.) to'xtatma: faqat o'zing ishga tushirgan jarayonni PID bo'yicha to'xtat. Foydalanuvchining boshqa jarayonlariga tegma.

## Rollar

- `student` (o'quvchi) — frontend `/kabinet`.
- `teacher` (o'qituvchi) — frontend `/ustoz`.
- Mehmon (accountsiz) — ommaviy sahifalar.

## Bosqich tayyor mezoni (Definition of Done)

1. Backend: `ruff` va `pytest` yashil.
2. `make schema` va `make types` ishga tushirilgan, natija commit qilingan.
3. Frontend (`frontend/` da): `typecheck`, `lint`, `test`, `build` yashil.
4. Bosqichning smoke testi o'tgan (`make smoke`; Playwright e2e — `make e2e` — keyingi bosqichda).
5. README yangilangan.
