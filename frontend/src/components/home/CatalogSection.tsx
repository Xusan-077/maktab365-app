import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { PdfCatalogView } from "@/components/pdf/PdfCatalogView";
import { Skeleton } from "@/components/ui/Skeleton";
import { CATALOG_ID } from "./ids";
import { Section } from "./Section";

/** Bosh sahifadagi katalog: sinf → fan → darsliklar (`/darsliklar` bilan bir xil ko'rinish). */
export function CatalogSection() {
  const t = useTranslations("home.catalog");
  return (
    <Section id={CATALOG_ID} title={t("title")} description={t("hint")}>
      {/* `useSearchParams` (URL filtrlari) uchun chegara */}
      <Suspense fallback={<Skeleton className="h-96" />}>
        <PdfCatalogView />
      </Suspense>
    </Section>
  );
}
