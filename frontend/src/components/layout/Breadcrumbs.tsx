import { Fragment } from "react";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";

export interface BreadcrumbItem {
  label: string;
  /** Oxirgi (joriy) element uchun berilmaydi. */
  href?: string;
}

/** Sinf → Fan → Kitob → Bob → Mavzu zanjiri uchun; oxirgi element `aria-current="page"`. */
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  const t = useTranslations("breadcrumb");
  return (
    <nav aria-label={t("label")} className="present:hidden text-sm">
      <ol className="text-muted flex flex-wrap items-center gap-x-1.5 gap-y-1">
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
              {!last && (
                <li aria-hidden className="flex items-center">
                  <ChevronRight className="size-3.5" />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
