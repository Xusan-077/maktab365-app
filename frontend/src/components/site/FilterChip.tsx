import type { ReactNode } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";

const chipBase =
  "inline-flex h-11 items-center justify-center rounded-full border px-4 text-sm whitespace-nowrap transition-colors";
const chipTone = (selected: boolean) =>
  selected
    ? "border-navy bg-navy text-background font-semibold"
    : "border-input-border bg-surface text-foreground hover:bg-surface-2 font-medium";

interface FilterChipBase {
  selected?: boolean;
  children: ReactNode;
  className?: string;
}

export type FilterChipProps = FilterChipBase &
  (
    | { href: string; onClick?: never; role?: never }
    | { href?: never; onClick: () => void; role?: "tab" }
  );

/**
 * Filtr/tab tugmasi (pill). `href` bo'lsa havola (URL searchParams, SEO), `onClick` bo'lsa tugma.
 * `role="tab"` — tablist ichida (`aria-selected`), aks holda `aria-pressed`.
 */
export function FilterChip(props: FilterChipProps) {
  const { selected = false, children, className } = props;
  const classes = cn(chipBase, chipTone(selected), className);
  if (props.href !== undefined) {
    return (
      <Link href={props.href} aria-current={selected ? "true" : undefined} className={classes}>
        {children}
      </Link>
    );
  }
  const tab = props.role === "tab";
  return (
    <button
      type="button"
      role={tab ? "tab" : undefined}
      aria-selected={tab ? selected : undefined}
      aria-pressed={tab ? undefined : selected}
      onClick={props.onClick}
      className={classes}
    >
      {children}
    </button>
  );
}

/** Aktiv filtr belgisi ("9-sinf ✕"): bosilsa filtr olib tashlanadi (`removeHref`). */
export function ActiveFilterChip({
  label,
  removeHref,
  className,
}: {
  label: string;
  removeHref: string;
  className?: string;
}) {
  const t = useTranslations("site");
  return (
    <Link
      href={removeHref}
      aria-label={t("removeFilter", { label })}
      className={cn(
        "bg-brand-soft text-brand-text relative inline-flex h-[2.125rem] items-center gap-1.5 rounded-full px-3 text-sm font-semibold",
        // ko'rinadigan balandlik dizaynda 34px; bosish maydoni 44px gacha kengaytiriladi
        "after:absolute after:inset-x-0 after:-inset-y-[0.4375rem]",
        className,
      )}
    >
      {label}
      <X className="size-3.5" strokeWidth={2.5} aria-hidden />
    </Link>
  );
}
