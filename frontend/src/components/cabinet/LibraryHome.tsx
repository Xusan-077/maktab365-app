"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { PdfBookCard } from "@/components/pdf/PdfBookCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { PAGE_STACK } from "@/components/layout/containers";
import { buttonVariants } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useMe } from "@/hooks/useMe";
import { Link } from "@/lib/i18n/navigation";
import { pdfQueries } from "@/lib/pdf-books/queries";
import { cn } from "@/lib/utils/cn";
import { catalogPath, ROUTES, type PanelBase } from "@/lib/utils/routes";
import { ContinueCard } from "./ContinueCard";
import { EmptyText, Panel } from "./Panel";
import { SavedBooks } from "./SavedBooks";

const PANEL_LIST_LIMIT = 4;

function StartCard() {
  const t = useTranslations("library.continue");
  const { data: me } = useMe();
  const grade = me?.role === "student" ? me.grade : undefined;
  const href = grade === undefined ? catalogPath() : `${catalogPath()}?grade=${grade}`;
  return (
    <section className="border-border bg-surface flex flex-col items-start gap-3 rounded-xl border p-6">
      <h2 className="text-2xl font-semibold tracking-tight">{t("emptyTitle")}</h2>
      <EmptyText>{t("emptyText")}</EmptyText>
      <Link href={href} className={buttonVariants({ size: "lg" })}>
        {t("browse")}
      </Link>
    </section>
  );
}

/**
 * Kabinet va ustoz paneli bosh sahifasi: oxirgi ochilgan darslik ("Davom ettirish"), oxirgi
 * ochilganlar va saqlanganlar. Ma'lumot bitta `me/library/` so'rovidan keladi.
 */
export function LibraryHome({ base }: { base: PanelBase }) {
  const t = useTranslations(base === "ustoz" ? "teacher" : "cabinet");
  const tl = useTranslations("library");
  const { signedIn } = useAuth();
  const { data: me } = useMe();
  const { data, isPending, isError } = useQuery({ ...pdfQueries.library(), enabled: signedIn });

  const [latest, ...older] = data?.items ?? [];
  const savedCount = data?.saved_count ?? 0;
  const savedHref = base === "ustoz" ? ROUTES.teacherSaved : ROUTES.cabinetSaved;

  return (
    <div className={PAGE_STACK}>
      <PageHeader title={t("greeting", { name: me?.name ?? "" })} description={t("lead")} />

      {isPending ? (
        <Skeleton className="h-44 w-full rounded-xl" />
      ) : isError ? (
        <EmptyText>{tl("loadFailed")}</EmptyText>
      ) : latest ? (
        <ContinueCard item={latest} />
      ) : (
        <StartCard />
      )}

      {(latest || savedCount > 0) && (
        <div className={cn("grid gap-4", older.length > 0 && "lg:grid-cols-2")}>
          {older.length > 0 && (
            <Panel title={tl("recent.title")}>
              <ul className="flex flex-col gap-3">
                {older.slice(0, PANEL_LIST_LIMIT).map((item) => (
                  <li key={item.book.id}>
                    <PdfBookCard layout="row" book={item.book} resumePage={item.last_page} />
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <Panel
            title={tl("saved.title")}
            footer={
              savedCount > PANEL_LIST_LIMIT && (
                <Link href={savedHref} className="text-link hover:underline">
                  {tl("saved.all", { count: savedCount })}
                </Link>
              )
            }
          >
            <SavedBooks limit={PANEL_LIST_LIMIT} />
          </Panel>
        </div>
      )}
    </div>
  );
}
