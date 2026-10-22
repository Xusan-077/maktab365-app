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
  // Eski kitob/mavzu sahifalari: `/darsliklar/{kitob}/{mavzu}` (bitta bo'lak — kitob — sahifaning o'zida)
  { source: `/${LOCALE}/darsliklar/:book/:topic`, destination: "/:locale/darsliklar" },
  // Kitob id'si uuid: eski slug'lar (`algebra-9`) katalogga ketadi
  {
    source: `/${LOCALE}/darsliklar/:slug((?![0-9a-fA-F]{8}-[0-9a-fA-F]{4}-).+)`,
    destination: "/:locale/darsliklar",
  },
  { source: `/${LOCALE}/fanlar`, destination: "/:locale/darsliklar" },
  { source: `/${LOCALE}/fanlar/:subject`, destination: "/:locale/darsliklar?subject=:subject" },
  // Panel ichidagi eski bo'limlar
  { source: `/${LOCALE}/kabinet/darsliklar/:path*`, destination: "/:locale/darsliklar" },
  { source: `/${LOCALE}/kabinet/fanlar/:path*`, destination: "/:locale/darsliklar" },
  { source: `/${LOCALE}/kabinet/natijalar`, destination: "/:locale/kabinet" },
  { source: `/${LOCALE}/ustoz/darsliklar/:path*`, destination: "/:locale/darsliklar" },
  { source: `/${LOCALE}/ustoz/fanlar/:path*`, destination: "/:locale/darsliklar" },
  { source: `/${LOCALE}/ustoz/mavzular`, destination: "/:locale/ustoz" },
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
};

export default withNextIntl(nextConfig);
