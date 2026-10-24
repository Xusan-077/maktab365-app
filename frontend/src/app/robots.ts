import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/i18n/seo";

/** Shaxsiy bo'limlar va API indekslanmaydi; sitemap manzili ko'rsatiladi. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/*/admin", "/*/kabinet", "/*/ustoz", "/*/sozlamalar"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
