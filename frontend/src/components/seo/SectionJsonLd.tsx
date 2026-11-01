import { getTranslations } from "next-intl/server";
import { JsonLd } from "@/components/pdf/JsonLd";
import type { Locale } from "@/lib/i18n/config";
import { SITE_URL } from "@/lib/i18n/seo";
import { breadcrumbList } from "@/lib/seo/jsonld";
import { ROUTES } from "@/lib/utils/routes";

/** Ichki sahifa uchun `BreadcrumbList`: Bosh sahifa → shu sahifa (`name`, `path` — tilsiz yo'l). */
export async function SectionJsonLd({
  locale,
  name,
  path,
}: {
  locale: Locale;
  name: string;
  path: string;
}) {
  const tn = await getTranslations({ locale, namespace: "nav" });
  return (
    <JsonLd
      data={breadcrumbList(SITE_URL, locale, [
        { name: tn("home"), path: ROUTES.home },
        { name, path },
      ])}
    />
  );
}
