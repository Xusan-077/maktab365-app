"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { adminQueries } from "@/lib/admin/queries";
import { PAGE_SIZE } from "@/lib/admin/types";
import { usePathname, useRouter } from "@/lib/i18n/navigation";
import { Pagination } from "./Pagination";
import { QueryError } from "./QueryError";
import { useDebouncedSearch } from "./useDebouncedSearch";

/** Foydalanuvchilar ro'yxati (faqat o'qish; faqat admin): qidiruv va sahifalash URL'da. */
export function UsersView() {
  const t = useTranslations("admin.users");
  const tr = useTranslations("admin.roles");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.get("q")?.trim() || undefined;
  const pageParam = Number(searchParams.get("page"));
  const page = Number.isInteger(pageParam) && pageParam > 1 ? pageParam : 1;
  const params = useMemo(() => ({ page, search }), [page, search]);
  const { data, error, isPending, refetch } = useQuery(adminQueries.users(params));
  const [text, setText] = useDebouncedSearch(search, (next) =>
    router.replace(next ? `${pathname}?${new URLSearchParams({ q: next })}` : pathname),
  );

  const goToPage = (next: number) => {
    const query = new URLSearchParams();
    if (search) query.set("q", search);
    if (next > 1) query.set("page", String(next));
    router.replace(query.size ? `${pathname}?${query}` : pathname);
  };

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div role="search" className="relative max-w-sm">
        <Search
          className="text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden
        />
        <input
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          aria-label={t("search")}
          placeholder={t("search")}
          className="border-border bg-surface text-foreground placeholder:text-muted hover:border-primary-300 h-10 w-full rounded-lg border pr-3 pl-9 text-sm shadow-xs transition-colors"
        />
      </div>

      {error ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : isPending ? (
        <div role="status" aria-label={t("loading")} className="flex flex-col gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : data.results.length === 0 ? (
        <EmptyState icon={Users}>{t("empty")}</EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="border-border bg-surface overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[32rem] text-sm">
              <caption className="sr-only">{t("title")}</caption>
              <thead className="bg-subtle text-muted">
                <tr>
                  <th scope="col" className="px-4 py-2.5 text-left font-medium">
                    {t("columns.email")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-left font-medium">
                    {t("columns.role")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-left font-medium">
                    {t("columns.status")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-left font-medium">
                    {t("columns.joined")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {data.results.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-3">{user.email ?? t("noEmail")}</td>
                    <td className="px-4 py-3">{tr(user.role)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={user.is_active ? "success" : "danger"}>
                        {t(user.is_active ? "active" : "inactive")}
                      </Badge>
                    </td>
                    <td className="text-muted px-4 py-3 whitespace-nowrap">
                      {new Date(user.date_joined).toLocaleDateString(locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={data.count} onPageChange={goToPage} />
        </div>
      )}
    </>
  );
}
