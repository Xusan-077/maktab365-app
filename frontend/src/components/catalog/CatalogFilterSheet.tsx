"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog } from "@/components/ui/Dialog";
import {
  activeFilterCount,
  catalogFiltersKey,
  type CatalogFilters as Filters,
} from "@/lib/pdf/catalog-filters";
import { CatalogFilters } from "./CatalogFilters";

/** <1024px: "Filtrlar (N)" tugmasi va pastdan chiqadigan sheet (o'zgarishlar "Ko'rsatish" bilan qo'llanadi). */
export function CatalogFilterSheet({ filters }: { filters: Filters }) {
  const t = useTranslations("catalogPage");
  const [open, setOpen] = useState(false);
  const count = activeFilterCount(filters);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-input-border bg-surface hover:bg-surface-2 flex h-11 items-center gap-2 rounded-xl border px-4 text-[0.9375rem] font-semibold transition-colors lg:hidden"
      >
        <SlidersHorizontal className="size-4" aria-hidden />
        {count > 0 ? t("filtersWithCount", { count }) : t("filters")}
      </button>
      <Dialog open={open} onOpenChange={setOpen} title={t("filters")} placement="bottom">
        <CatalogFilters
          key={catalogFiltersKey(filters)}
          filters={filters}
          deferred
          onApplied={() => setOpen(false)}
        />
      </Dialog>
    </>
  );
}
