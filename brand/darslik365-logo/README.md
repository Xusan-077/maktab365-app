# darslik365 — logo to'plami

Ranglar: ko'k `#1554D1` · to'q ko'k `#071633` · qorong'i fon uchun ko'k `#4C8BFF`

## Papkalar
- `svg/` — asosiy vektor fayllar (sayt uchun shular)
  - `logo` — gorizontal, oq fon uchun
  - `logo-dark-bg` — qorong'i fon uchun
  - `logo-white` / `logo-black` — bir rangli
  - `logo-stacked*` — vertikal (ikonka tepada)
  - `wordmark*` — faqat yozuv
  - `icon*` — faqat kitob belgisi
  - `app-icon*` — ko'k fonli ilova ikonkasi (rounded, square, maskable)
- `png/` — 512/1024/2048 px (ikonkalar 256/512/1024), shaffof fon
- `favicon/` — favicon.ico, favicon.svg, 16–96 px, apple-touch-icon, android-chrome, maskable, site.webmanifest
- `social/` — OG image (oq/qora), Twitter header, Facebook cover, avatar 800×800

## Next.js (App Router)
`favicon/` ichidagilarni `public/` ga ko'chiring, so'ng `app/layout.tsx`:

```ts
export const metadata: Metadata = {
  title: "darslik365",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  openGraph: { images: ["/og-image-1200x630.png"] },
};
export const viewport: Viewport = { themeColor: "#1554D1" };
```

Header uchun: `<Image src="/logo.svg" alt="darslik365" width={200} height={34} priority />`
(dark mode: `logo-dark-bg.svg`).
