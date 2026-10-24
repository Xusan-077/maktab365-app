"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { PdfBookCard } from "@/components/pdf/PdfBookCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { PAGE_STACK } from "@/components/layout/containers";
import { buttonVariants } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useMe } from "@/hooks/useMe";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import type { Dashboard, TeacherDashboard } from "@/lib/pdf-books/api";
import { pdfQueries } from "@/lib/pdf-books/queries";
import { cn } from "@/lib/utils/cn";
import { catalogPath, ROUTES, type PanelBase } from "@/lib/utils/routes";
import { ContinueCard } from "./ContinueCard";
import { GoalsPanel } from "./GoalsPanel";
import { EmptyText, Panel } from "./Panel";
import { SavedBooks } from "./SavedBooks";

const PANEL_LIST_LIMIT = 4;

function StartCard() {
  const t = useTranslations("library.continue");
  const { data: me } = useMe();
  const grade = me?.role === "student" ? me.grade : undefined;
  const href = grade === undefined ? catalogPath() : `${catalogPath()}?sinf=${grade}`;
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

function Stat({ value, label, testId }: { value: number; label: string; testId: string }) {
  return (
    <div className="border-border bg-surface flex flex-col gap-0.5 rounded-xl border px-4 py-3">
      <dd className="text-2xl font-semibold tabular-nums" data-testid={testId}>
        {value}
      </dd>
      <dt className="text-muted text-sm">{label}</dt>
    </div>
  );
}

function Stats({ data }: { data: Dashboard }) {
  const t = useTranslations("library.stats");
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="dashboard-stats">
      <Stat value={data.week.opened} label={t("weekOpened")} testId="stat-week-opened" />
      <Stat value={data.week.read} label={t("weekRead")} testId="stat-week-read" />
      <Stat value={data.saved_count} label={t("saved")} testId="stat-saved" />
      <Stat value={data.open_goals} label={t("goals")} testId="stat-goals" />
    </dl>
  );
}

function ReviewPanel({ data }: { data: Dashboard }) {
  const t = useTranslations("library.review");
  if (data.review.length === 0) return null;
  return (
    <Panel title={t("title")} note={t("note")}>
      <ul className="flex flex-col gap-3" data-testid="review-list">
        {data.review.slice(0, PANEL_LIST_LIMIT).map((item) => (
          <li key={item.book.id}>
            <PdfBookCard layout="row" book={item.book} resumePage={item.last_page} />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function SubjectsPanel({ data, base }: { data: Dashboard; base: PanelBase }) {
  const t = useTranslations("library.subjects");
  const locale = useLocale() as Locale;
  if (data.subjects.length === 0) return null;
  return (
    <Panel
      title={t("title")}
      footer={
        base === "kabinet" && (
          <Link href={ROUTES.cabinetSubjects} className="text-link hover:underline">
            {t("all")}
          </Link>
        )
      }
    >
      <ul className="flex flex-col gap-4">
        {data.subjects.slice(0, PANEL_LIST_LIMIT).map((subject) => (
          <li key={subject.slug} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <Link
                href={`${catalogPath()}?subject=${subject.slug}`}
                className="font-medium hover:underline"
              >
                {getLocalized(subject.title, locale)}
              </Link>
              <span className="text-muted text-sm tabular-nums">
                {t("progress", { read: subject.books_read, total: subject.books_total })}
              </span>
            </div>
            <ProgressBar
              value={subject.books_read}
              max={Math.max(subject.books_total, 1)}
              label={getLocalized(subject.title, locale)}
            />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function GradesPanel({ data }: { data: TeacherDashboard }) {
  const t = useTranslations("library.grades");
  if (data.grades.length === 0) {
    return (
      <Panel title={t("title")}>
        <EmptyText>{t("empty")}</EmptyText>
      </Panel>
    );
  }
  return (
    <Panel title={t("title")} note={t("note")}>
      <ul className="flex flex-col gap-4" data-testid="grades-list">
        {data.grades.map((row) => (
          <li key={row.grade} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <Link
                href={`${catalogPath()}?sinf=${row.grade}`}
                className="font-medium hover:underline"
              >
                {t("grade", { grade: row.grade })}
              </Link>
              <span className="text-muted text-sm tabular-nums">
                {t("progress", { opened: row.books_opened, total: row.books_total })}
              </span>
            </div>
            <ProgressBar
              value={row.books_opened}
              max={Math.max(row.books_total, 1)}
              label={t("grade", { grade: row.grade })}
            />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/**
 * Kabinet va ustoz paneli bosh sahifasi: oxirgi ochilgan darslik ("Davom ettirish"), haftalik
 * ko'rsatkichlar, takrorlash kerak kitoblar, fanlarim, rejalar va saqlanganlar. Ma'lumot
 * `me/dashboard/` (ustozda `me/teacher/dashboard/`) so'rovidan keladi.
 */
export function LibraryHome({ base }: { base: PanelBase }) {
  const t = useTranslations(base === "ustoz" ? "teacher" : "cabinet");
  const tl = useTranslations("library");
  const { signedIn } = useAuth();
  const { data: me } = useMe();
  const teacher = base === "ustoz";
  const studentQuery = useQuery({ ...pdfQueries.dashboard(), enabled: signedIn && !teacher });
  const teacherQuery = useQuery({ ...pdfQueries.teacherDashboard(), enabled: signedIn && teacher });
  const query = teacher ? teacherQuery : studentQuery;
  const data = query.data;
  const latest = data?.continue ?? null;
  const savedCount = data?.saved_count ?? 0;
  const savedHref = teacher ? ROUTES.teacherSaved : ROUTES.cabinetSaved;

  return (
    <div className={PAGE_STACK}>
      <PageHeader title={t("greeting", { name: me?.name ?? "" })} description={t("lead")} />

      {query.isPending ? (
        <Skeleton className="h-44 w-full rounded-xl" />
      ) : query.isError || !data ? (
        <EmptyText>{tl("loadFailed")}</EmptyText>
      ) : (
        <>
          {latest ? <ContinueCard item={latest} /> : <StartCard />}
          {latest && <Stats data={data} />}

          <div className={cn("grid gap-4", "lg:grid-cols-2")}>
            <ReviewPanel data={data} />
            {teacher && "grades" in data ? (
              <GradesPanel data={data as TeacherDashboard} />
            ) : (
              <SubjectsPanel data={data} base={base} />
            )}
            <GoalsPanel />
            {(latest || savedCount > 0) && (
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
            )}
          </div>
        </>
      )}
    </div>
  );
}
