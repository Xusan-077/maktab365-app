"use client";

import { useEffect, useState } from "react";
import { LayoutGrid, List } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";

export type ViewMode = "list" | "grid";

/** Ko'rinish tanlovi brauzerda eslab qolinadi (har ro'yxat uchun alohida kalit). */
export function useViewMode(key: string): [ViewMode, (mode: ViewMode) => void] {
  const storageKey = `maktab365-admin-view:${key}`;
  const [mode, setMode] = useState<ViewMode>("list");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR bilan mos kelishi uchun saqlangan qiymat mount'dan keyin o'qiladi
      if (saved === "list" || saved === "grid") setMode(saved);
    } catch {
      /* localStorage yopiq bo'lsa, standart ko'rinish */
    }
  }, [storageKey]);

  const update = (next: ViewMode) => {
    setMode(next);
    try {
      window.localStorage.setItem(storageKey, next);
    } catch {
      /* saqlab bo'lmasa ham ko'rinish almashadi */
    }
  };
  return [mode, update];
}

export function ViewToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  const t = useTranslations("admin.common.view");
  const options = [
    { mode: "list", Icon: List, label: t("list") },
    { mode: "grid", Icon: LayoutGrid, label: t("grid") },
  ] as const;
  return (
    <div
      role="group"
      aria-label={t("label")}
      className="border-border bg-surface inline-flex rounded-lg border p-0.5 shadow-xs"
    >
      {options.map(({ mode, Icon, label }) => (
        <button
          key={mode}
          type="button"
          aria-pressed={value === mode}
          aria-label={label}
          title={label}
          onClick={() => onChange(mode)}
          className={cn(
            "inline-flex size-9 items-center justify-center rounded-md transition-colors sm:size-8",
            value === mode ? "bg-primary-600 text-white" : "text-muted hover:bg-subtle",
          )}
        >
          <Icon className="size-4" aria-hidden />
        </button>
      ))}
    </div>
  );
}
