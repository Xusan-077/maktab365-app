# Maktab365

1–11-sinf darsliklari mavzular bo'yicha, bepul, o'quvchi va o'qituvchi uchun platforma.

> Bu fayl monorepo ichidagi `frontend/` papkasiga tegishli (ildiz qoidalari: `../CLAUDE.md`). Barcha yo'llar `frontend/` ga nisbatan; buyruqlar `frontend/` ichida ishga tushiriladi.

## Stack

Next.js (App Router) · TypeScript · Tailwind v4 · ESLint + Prettier · `src/` papka, alias `@/*`.
TanStack Query (server state), Zustand (client state), react-hook-form + yup (+ `@hookform/resolvers`),
framer-motion, next-intl, clsx + tailwind-merge (`cn()` — `src/lib/utils/cn.ts`), lucide-react, qrcode.react.

> Next.js versiyasi yangi — kod yozishdan oldin `node_modules/next/dist/docs/` dagi tegishli qo'llanmani o'qing (qarang: `AGENTS.md`).

## Papka qoidalari

- `src/app` — faqat routing: `page`, `layout`, `loading`, `error`, route handler. Mantiq va katta JSX bu yerda emas.
- `src/app/[locale]/` route guruhlari: `(marketing)` (bosh sahifa, darsliklar, fanlar, loyiha haqida, yordam — header+footer), `(auth)` (kirish, onboarding — faqat logo va forma), `(app)` (`kabinet`, `ustoz`, `sozlamalar` — `AppShell`: sidebar+topbar, marketing header/footer yo'q). Katalog/fan/kitob/mavzu sahifalari `CatalogPageContent`, `SubjectPageContent`, `BookPageContent`, `TopicPageContent` ga chiqarilgan va marketing hamda panel sahifalari ularni `base` (`marketing | kabinet | ustoz`) bilan qayta ishlatadi.
- Ichki havolalar kontekstga qarab: serverda `bookPath(id, base)` kabi yordamchilar (`lib/utils/routes.ts`), klientda `useAppBase()` / `useAppPaths()`. `/ustoz`↔`/kabinet` rol redirect'i `src/proxy.ts` da (`maktab365-role` cookie'si bo'yicha), haqiqiy tekshiruv `AccountGate` da.
- Logo faqat `components/layout/Logo.tsx` orqali (`/logo-*.svg`, `public/`).
- `src/components/ui` — umumiy, domenga bog'liq bo'lmagan primitivlar (Button, Input, Modal…).
- `src/components/layout` — header, footer, navigatsiya, sahifa qobiqlari.
- `src/components/{home,catalog,topic,cabinet}` — shu sahifa/domen komponentlari.
- `src/lib/api` — API klient va so'rov funksiyalari. `schema.ts` — `backend/openapi.yaml` dan **generatsiya** (qo'lda tahrirlanmaydi; `npm run api:types` / `make types`). `http-client.ts` — typed `openapi-fetch` klienti (timeout, `X-Request-ID`, xatolar → `ApiError{status,code,details,requestId}`); `HttpApi` undan foydalanadi, `NEXT_PUBLIC_API_MODE=mock|http` tanlaydi. `src/lib/utils` — sof yordamchi funksiyalar. `src/lib/i18n` — next-intl sozlamasi va `messages/*.json`.
- `src/stores` — Zustand store'lar. `src/hooks` — umumiy hook'lar. `src/types` — umumiy TypeScript tiplar.
- `src/mocks` — **mock data faqat shu yerda**. Boshqa joyda mock/fake ma'lumot yozilmaydi.

## Nomlash qoidalari

- Komponent fayllari va komponentlar: `PascalCase` (`TopicCard.tsx`). Hook fayllari: `useXxx.ts`. Qolgan fayllar va papkalar: `kebab-case`.
- Hook'lar `useXxx`, store'lar `useXxxStore` (`src/stores/auth.store.ts`), tiplar `PascalCase`, konstantalar `UPPER_SNAKE_CASE`.
- Named export afzal; default export faqat Next.js talab qilganda (`page`, `layout`…).
- Importlar `@/*` alias orqali, chuqur nisbiy (`../../..`) yo'llar yo'q.

## Asosiy qoidalar

1. **UI matnlari faqat i18n orqali, hardcode yo'q.** Barcha matn `src/lib/i18n/messages/*.json` da; serverda `getTranslations`, klientda `useTranslations`. JSX ichida, `aria-label`, `placeholder`, `title`, metadata'da ham literal matn yozilmaydi.
2. **Server komponent default, `'use client'` faqat kerak bo'lganda** (state, effect, brauzer API, event handler, hook'lar). Iloji boricha client chegarasini kichik, barg komponentlarga tushiring.
3. **Mock data faqat `src/mocks` da.**
4. Stilda `cn()` dan foydalaning; Tailwind v4 utility'lari, ranglar/tokenlar `globals.css` dagi `@theme` da.
5. Formalar: react-hook-form + yup sxemasi.

## Skriptlar

- `npm run dev` — dev server
- `npm run build` — production build
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — ESLint
- `npm run api:types` — `src/lib/api/schema.ts` ni `../backend/openapi.yaml` dan generatsiya qiladi
- `npm run smoke` — smoke: backend `/health/` va `/dev/api-status` (stack ishlab turishi kerak)
- `npm run format` / `npm run format:check` — Prettier

Ish tugagach `npm run typecheck`, `npm run lint` va `npm run build` o'tishi kerak.

## Dizayn tizimi

- Tokenlar `src/app/globals.css` da (`@theme`): `primary-50…900` (ko'k), `accent-50…500` (och sariq, muhim fikrlar uchun), semantik `background / surface / subtle / foreground / muted / border / ring / link` + `*-soft` juftliklari. Light/dark qiymatlari CSS o'zgaruvchilarda (`:root` va `:root[data-theme="dark"]`), shuning uchun komponentlarda `dark:` deyarli kerak emas. Ranglarni hex bilan yozmang — token ishlating.
- Kontrast: to'ldirilgan tugma/belgi foni `primary-600` (500 oq matn bilan AA dan past), matn-havola uchun `text-link`.
- Theme (`system/light/dark`) va matn hajmi (`s/m/l`) `usePreferencesStore` da (localStorage `maktab365-prefs`). `<html>` da `data-theme`, `data-theme-pref`, `data-text-size`; birinchi paintdan oldin `<head>` dagi inline skript (`PREFERENCES_INIT_SCRIPT`) qo'yadi.
- UI komponentlar: `src/components/ui` (Button, Input, Select, Card, Badge, Chip, Tabs, Accordion, Dialog, Toast, Skeleton, ProgressBar). Native elementlar (`<dialog>`, `<details>`) afzal; `<select>` esa taqiqlangan (ESLint `no-restricted-syntax`) — o'rniga `Select` / `MultiSelect` (RHF `Controller` bilan; mobilda bottom sheet). Hammasida `focus-visible` global. Toast: `useToast()` hook.
- Sahifa tuzilishi: `PageHeader` (sarlavha + izoh + bitta asosiy harakat), `EmptyState` (ikonka + bitta gap + bitta tugma), konteynerlar `components/layout/containers.ts` (marketing `max-w-6xl`, panellar to'liq kenglik (`AppShell`), mavzu matni `70ch`), bo'limlar orasi `PAGE_STACK` (`gap-8`). Har ekranda bitta asosiy harakat.
- `/dev/ui` — barcha komponentlar namunasi, `/dev/api-status` — backend `/health/` holati; ikkalasi faqat development'da (production'da 404).
