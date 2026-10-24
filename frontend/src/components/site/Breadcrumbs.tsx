import { Fragment } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";

export interface BreadcrumbItem {
  label: string;
  /** Oxirgi (joriy) element uchun berilmaydi. */
  href?: string;
}

/** "Bosh sahifa / Fanlar" — sahifa tepasidagi yo'l; oxirgi element `aria-current="page"`. */
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  const t = useTranslations("site");
  return (
    <nav aria-label={t("breadcrumb")} className="present:hidden text-faint text-sm">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <Fragment key={`${index}-${item.label}`}>
              <li className="min-w-0">
                {item.href && !last ? (
                  <Link
                    href={item.href}
                    className="hover:text-foreground rounded-md hover:underline"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span aria-current={last ? "page" : undefined} className="text-foreground">
                    {item.label}
                  </span>
                )}
              </li>
              {!last && <li aria-hidden>/</li>}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
