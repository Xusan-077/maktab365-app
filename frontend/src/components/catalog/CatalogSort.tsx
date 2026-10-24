"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Select } from "@/components/ui/Select";
import { useRouter } from "@/lib/i18n/navigation";
import {
  catalogHref,
  type CatalogFilters,
  type CatalogSort as Sort,
} from "@/lib/pdf/catalog-filters";
import { ROUTES } from "@/lib/utils/routes";

/** "Saralash": sinf bo'yicha yoki yangi qo'shilgan (URL `?tartib=yangi`). */
export function CatalogSort({ filters }: { filters: CatalogFilters }) {
  const t = useTranslations("catalogPage");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2 text-sm" aria-busy={pending}>
      <span className="text-muted">{t("sort")}</span>
      <Select
        aria-label={t("sort")}
        value={filters.sort}
        searchable={false}
        options={[
          { value: "grade", label: t("sortGrade") },
          { value: "newest", label: t("sortNewest") },
        ]}
        onChange={(value) =>
          startTransition(() =>
            router.push(catalogHref(ROUTES.textbooks, filters, { sort: value as Sort }), {
              scroll: false,
            }),
          )
        }
        className="w-52"
      />
    </div>
  );
}
