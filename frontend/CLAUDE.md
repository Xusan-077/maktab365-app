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
- Ichki havolalar kontekstga qarab: serverda `bookPath(id, base)` kabi yordamchilar (`lib/utils/routes.ts`), klientda `useAppBase()` / `useAppPaths()`. `/ustoz`↔`/kabinet` rol redirect'i `src/proxy.ts` da (sessiyadagi `role`/`onboarded` bo'yicha), haqiqiy tekshiruv `AccountGate` da.
- Logo faqat `components/layout/Logo.tsx` orqali (`/logo-*.svg`, `public/`).
- `src/components/ui` — umumiy, domenga bog'liq bo'lmagan primitivlar (Button, Input, Modal…).
- `src/components/layout` — header, footer, navigatsiya, sahifa qobiqlari.
- `src/components/{home,catalog,topic,cabinet}` — shu sahifa/domen komponentlari.
- `src/lib/api` — API klient va so'rov funksiyalari. `schema.ts` — `backend/openapi.yaml` dan **generatsiya** (qo'lda tahrirlanmaydi; `npm run api:types` / `make types`). `http-client.ts` — typed `openapi-fetch` klienti (timeout, `X-Request-ID`, xatolar → `ApiError{status,code,details,requestId}`); `HttpApi` undan foydalanadi, `NEXT_PUBLIC_API_MODE=mock|http` tanlaydi. `src/lib/utils` — sof yordamchi funksiyalar. `src/lib/i18n` — next-intl sozlamasi va `messages/*.json`.
- `src/lib/auth` — auth (M3, M4). Barcha kirish usuli (`auth.config.ts`) backend JWT juftligiga olib keladi: Credentials `password`, `telegram`, `otp` (`social-providers.ts`, `password-provider.ts`) va Google — OAuth, lekin `signIn` callback'ida `id_token` backend `/auth/google/` ga almashtiriladi (`googleSignIn`; Google'ning o'z sessiyasi/profili ishlatilmaydi, to'qnashuv xatolari `/kirish?authError=<kod>` ga qaytadi). Backend JWT'lari faqat shifrlangan Auth.js cookie'sida; sessiyada `user.{role,onboarded,emailVerified}`. Kirish sahifasi (`/kirish`, `LoginView`) bir qadamli: Google/Telegram (`SocialSignIn`), "yoki", email → almashadigan panelda parol (`EmailStep`/`PasswordStep`; 1-qadamda backend'ga so'rov yo'q — akkaunt mavjudligi oshkor bo'lmasin); ro'yxatdan o'tish alohida `/royxatdan-otish` (`RegisterView`). Telegram: `TelegramLoginButton` (rasmiy widget, `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`); email kodi: `/kod` (`OtpView`, `OtpCodeInput`, sof mantiq `lib/auth/otp.ts`). Sozlamalar → Xavfsizlik: `LinkedIdentities` (Google GIS tugmasi `googleClientId` prop'i bilan — server sahifa `GOOGLE_CLIENT_ID` ni beradi). Qoidalar:
  - Brauzer backend'ga faqat BFF orqali: `/api/backend/<api yo'li>` (`app/api/backend/[...path]`, `auth()` o'ralgan) — Bearer serverda qo'shiladi, CSRF tekshiruvi bor. Brauzer slash'siz yuboradi (Next 308 qilmasin), BFF qaytaradi.
  - Refresh faqat `jwt` callback'ida (`jwt-callback.ts`), cookie saqlanadigan joylarda: proxy, `/api/auth/session`, `auth()` o'ralgan route'lar. **RSC'da `auth()` chaqirmang** — u refresh qilib yangi cookie'ni yo'qotadi (rotation eski refresh'ni bekor qilgan bo'ladi). Server so'rovlari uchun `getServerAccessToken()` / `getServerApi()` (faqat dekodlaydi).
  - `refresh.ts` — bir jarayonda single-flight + 60s eslab qolish (`globalThis`).
  - Proxy yo'naltirishlari sof funksiyada: `lib/auth/redirects.ts` (testlari bor).
  - Sessiyani yangilash: `update({ ... })` — **argument bilan** (argumentsiz GET, `trigger: "update"` bo'lmaydi). Onboarding tugamaguncha `jwt` har o'qishda `/me/` ni o'qiydi.
  - Akkaunt metodlari (`ACCOUNT_METHODS`) mock rejimida ham `HttpApi` ga boradi (`withAccountApi`).
  - Xato kodlari → `authForm.errors.*` (`useAuthErrorText`).
- Katalog (M7): `API_MODE=http` da `getApi()` katalog (`CATALOG_METHODS`), akkaunt, o'qish jarayoni (`LEARNING_METHODS`) va health'ni `HttpApi` dan, qolganlarini `MockApi` dan oladi (`withMethods`). http rejimida id'lar slug'dan: fan `id = slug`, kitob `algebra-9`, bob `{kitob}-ch{order}`, mavzu `{kitob}-{slug}` (`catalog-mappers.ts`; `getTopic` kitob slug'ini kitoblar ro'yxatidan aniqlaydi). Server ma'lumoti (`lib/api/server.ts`) `"use cache"` + `cacheTag("content")` bilan; sahifada to'g'ridan-to'g'ri `getApi()` chaqirmang (Cache Components'da `crypto`/`Date.now` prerender'ni buzadi) — `server.ts` ga keshlangan funksiya qo'shing. Backend'siz build: yuklagichlar `guarded` bilan ulanish xatosida natijani keshlamaydi ("seconds" umri → prerender'da teshik, so'rov vaqtida to'ldiriladi); `generateMetadata` esa `get*Meta` (lenient) dan foydalanadi — `undefined` = backend yo'q (umumiy metadata), `null` = 404. Qidiruv snippeti: `splitSnippet` + `SearchSnippet` (HTML emas, `<mark>`).
- O'qish jarayoni (M8): `MaktabApi` da `getProgress/saveProgress` (PUT — idempotent, monoton), `recordTopicOpened`, `getRecent`, `getDashboard`, `getResults`, `getTeacherDashboard`, `mergeGuestData`, xatcho'p va maqsad metodlari; backend ↔ UI mapping `lib/api/learning-mappers.ts` (holatlar: `not_started|in_progress|read|passed` ↔ `none|started|completed` va `none|in_progress|completed`). Yozish yo'li: `useProgressRecorder` → mehmon `guest.store`, akkaunt uchun `recordForAccount` (optimistic kesh + `SyncQueue`, `lib/progress/`). Navbat elementlari: `progress` (to'liq holat + hodisa vaqti `updatedAt`), `bookmark`, `opened`; oflayn/sekin internetda `localStorage`da turadi, xatoda eksponensial kechikish bilan qayta uriniladi; server 4xx bilan rad etsa `onDropped` → `rollbackOptimistic` (kesh serverdagi holatga qaytadi). Maqsad va kitob xatcho'pi — TanStack mutation'lari optimistic `onMutate` + `onError` rollback. Kirgandan keyin `AuthProvider` `GuestMerger` (`lib/progress/guest-merge.ts`) ni ishga tushiradi (`merge-guest-data/`, 500 tadan bo'laklab; xatoda ma'lumot saqlanadi va qayta uriniladi). Kabinet (`CabinetView`, `ResultsView`, `SubjectsList`, `ReviewList`, `WeeklySummary`) `useDashboard`/`useResults`, ustoz paneli `useTeacherDashboard` dan oladi; katalog/kitob sahifasidagi "o'qilgan" belgilari `useProgress` (akkauntda server) dan. Mehmon rejimi o'zgarmagan. Mehmon ma'lumotini qo'shish qoidalari `lib/merge-guest-data.ts` (`mergeProgress`, `mergeBookmarks`) + `contracts/fixtures/merge-*.json` (backend bilan umumiy).
- `src/components/support` + `lib/support` + `lib/validation/support.ts` — "Yordam va aloqa" (M9): `SupportForm` (RHF+Yup, mehmonda email majburiy, honeypot `website` — to'ldirilsa `buildSupportInput` `null` qaytaradi va so'rov yuborilmaydi), `MySupportList`, `ReportErrorLink` (mavzudagi "Xato topdingizmi?" dialogi). `sendSupport`/`getMySupport` `ACCOUNT_METHODS` da.
- Admin (M10): `src/app/[locale]/(admin)/admin/**` — alohida qobiq (`AdminShell`: sidebar+topbar; marketing va o'quvchi/ustoz elementlari yo'q). Marshrutlar: `/admin`, `/admin/kitoblar[/yangi|/<id>]`, `/admin/mavzular/<id>|yangi?book=&chapter=`, `/admin/foydalanuvchilar` (faqat admin). Kirish: sessiyada `user.staff` (`editor|admin|null`, `lib/auth/tokens.ts`) — proxy `staff === null` bo'lsa 404'ga rewrite qiladi (`lib/auth/staff.ts`); layout'dagi `StaffGate` rolni backend `/me/` dan qayta tekshiradi (`lib/admin/server.ts`, `await connection()` — Cache Components) va `AdminRoleProvider` orqali mijozga beradi; `AdminOnly` — admin-only sahifalar. Editor rolini admin beradi, sessiyaga kirishda yoziladi (rol o'zgarsa qayta kirish kerak). Ma'lumot: `lib/admin/api.ts` (`AdminApi`, BFF orqali), `queries.ts` (barcha kalitlar `["admin", …]` ostida, yozuvdan keyin `ADMIN_ROOT_KEY` yangilanadi), ro'yxat holati URL'da (`list-params.ts`). Daraxt: sof mantiq `lib/admin/tree.ts` (`moveChapter/moveTopic/diffToReorder`), `BookTree` — HTML5 drag&drop + ↑/↓ tugmalari, optimistik, xatoda qaytadi. Nashr tugmalari `TransitionButtons` (`lib/admin/permissions.ts` backend `TRANSITIONS` nusxasi). BFF admin yozuvidan keyin `revalidateTag("content")` chaqiradi (`changesPublicContent`). Admin matnlari `admin.*` (uz, en; ru da hozircha en nusxasi).
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
- `npm test` — vitest (`*.test.ts` node'da, `*.test.tsx` komponent testlari faylning o'zida `// @vitest-environment jsdom` bilan)
- `npm run api:types` — `src/lib/api/schema.ts` ni `../backend/openapi.yaml` dan generatsiya qiladi
- `npx playwright test` (`make e2e`) — e2e: compose backend kerak (`docker compose up -d`, dev sozlamasi email kodini `/api/v1/dev/otp/` orqali beradi; ketma-ket kirishlar uchun backend'ni `AUTH_THROTTLE_RATE=1000/min SUPPORT_THROTTLE_RATE=1000/hour CELERY_TASK_ALWAYS_EAGER=true` bilan ishga tushiring); konfiguratsiya o'zi build qilib 3100-portda ishga tushiradi (`e2e/`).
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

## PDF darsliklar (M11)

- Admin: `/admin/pdf-kitoblar[/yangi|/<id>]` (`PdfBooksView`, `PdfBookWizard`, `PdfBookEditView`). Yuklash: `lib/admin/pdf-upload.ts` (`uploadPdf` + `xhrSender`; `direct` = R2'ga bo'laklab, `proxy` = BFF orqali dev) va `usePdfUpload` (fayl → muqova pdf.js bilan → `PATCH cover`). BFF PDF baytlarini faqat dev "proxy" rejimida o'tkazadi (`request-guards.ts`: tana chegaralari, Range sarlavhalari).
- Ochiq: `(marketing)/pdf-kitoblar[/<id>]`; `components/pdf/*` (katalog, `PdfReader` — faqat ko'rinayotgan sahifa chiziladi, `?page=` URL'da, ←/→, swipe), sof mantiq `lib/pdf/*` (`page-nav`, `swipe`, `progress`, `file-url`, `guest-merge`). pdf.js **faqat `legacy` build** (`lib/pdf/pdfjs.ts`, dinamik import) — oddiy build yangi brauzer API'lariga tayanadi. Progress: kirgan foydalanuvchi — `usePdfProgress` (debounce PUT), mehmon — `stores/pdf-guest.store.ts`, kirganda `AuthProvider` `merge-guest-data/` ga yuboradi.
- E2E: `e2e/pdf-books.spec.ts`; lokal backend bilan: `E2E_SKIP_IMPORT=1 E2E_MANAGE_CWD=<backend> npx playwright test` (hisoblar tasodifiy yaratiladi).
