import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/lib/i18n/request.ts");

/** `lib/i18n/config.ts` dagi tillar (u yerdan import qilib bo'lmaydi: config fayli alohida yuklanadi). */
const LOCALE = ":locale(uz|uz-Cyrl|ru|en)";

/**
 * Mavzu tizimi olib tashlangach eski manzillar yangi joyga yo'naltiriladi (308, saqlanadigan
 * qidiruv natijalari va xatcho'plar uchun). Tilsiz manzillar avval til prefiksini oladi (proxy),
 * keyin shu qoidalarga tushadi.
 */
const MOVED: { source: string; destination: string }[] = [
  // PDF darsliklar asosiy "Darsliklar" bo'limiga ko'chdi
  { source: `/${LOCALE}/pdf-kitoblar`, destination: "/:locale/darsliklar" },
  { source: `/${LOCALE}/pdf-kitoblar/:id`, destination: "/:locale/darsliklar/:id" },
  // Eski kitob/mavzu sahifalari: `/darsliklar/{kitob}/{mavzu}`. Sinf (`9`) bilan boshlangan yo'llar
  // yangi `/darsliklar/{sinf}/{slug}` manzillari — ularga tegilmaydi. (Pattern ichida `$` butun
  // yo'l oxirini bildiradi, shuning uchun sinf bo'lagi `/` bilan tekshiriladi.)
  {
    source: `/${LOCALE}/darsliklar/:book((?![0-9]{1,2}/)[^/]+)/:topic`,
    destination: "/:locale/darsliklar",
  },
  // Sinf sahifasi yo'q: `/darsliklar/9` → katalog filtri (so'rov parametrlari, masalan `?q=`, saqlanadi)
  {
    source: `/${LOCALE}/darsliklar/:sinf([0-9]{1,2})`,
    destination: "/:locale/darsliklar?sinf=:sinf",
  },
  { source: `/${LOCALE}/fanlar/:subject`, destination: "/:locale/darsliklar?fan=:subject" },
  // Panel ichidagi eski bo'limlar
  { source: `/${LOCALE}/kabinet/darsliklar/:path*`, destination: "/:locale/darsliklar" },
  // `/kabinet/fanlar` va `/kabinet/natijalar` — yana haqiqiy sahifalar (Fanlarim, Natijalar); eski ichki yo'llar (`/fanlar/<slug>`) yo'naltiriladi
  { source: `/${LOCALE}/kabinet/fanlar/:path+`, destination: "/:locale/darsliklar" },
  { source: `/${LOCALE}/ustoz/darsliklar/:path*`, destination: "/:locale/darsliklar" },
  { source: `/${LOCALE}/ustoz/fanlar/:path*`, destination: "/:locale/darsliklar" },
  { source: `/${LOCALE}/ustoz/mavzular`, destination: "/:locale/ustoz" },
  // Alohida ro'yxatdan o'tish yo'q: email kodi bilan kirganda akkaunt o'zi yaratiladi
  { source: `/${LOCALE}/royxatdan-otish`, destination: "/:locale/kirish" },
  // Admin: PDF kitoblar `/admin/kitoblar` ga ko'chdi, mavzu sahifalari yo'q
  { source: `/${LOCALE}/admin/pdf-kitoblar/:path*`, destination: "/:locale/admin/kitoblar/:path*" },
  { source: `/${LOCALE}/admin/mavzular/:path*`, destination: "/:locale/admin/kitoblar" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  redirects: async () => MOVED.map((rule) => ({ ...rule, permanent: true })),
  // Kirish sahifalari brauzer keshida turmasin: kirgan foydalanuvchini proxy har safar o'z paneliga
  // yo'naltiradi (aks holda `s-maxage`/`stale-while-revalidate` bilan eski "kirish" sahifasi ko'rinib qoladi).
  headers: async () => [
    {
      source: `/${LOCALE}/:page(kirish|kod|onboarding)`,
      headers: [{ key: "Cache-Control", value: "private, no-cache, no-store, max-age=0" }],
    },
  ],
};

export default withNextIntl(nextConfig);
