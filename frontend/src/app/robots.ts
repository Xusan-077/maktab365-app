import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/i18n/seo";
import { ROBOTS_DISALLOW } from "@/lib/seo/private-paths";

/** Shaxsiy bo'limlar, o'qish oynalari va API indekslanmaydi; sitemap manzili ko'rsatiladi. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ROBOTS_DISALLOW }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
