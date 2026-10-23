import {
  BadgeCheck,
  BookOpen,
  Download,
  HardDrive,
  Library,
  MousePointerClick,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { GRADE_STAGES, type GradeStats } from "@/lib/pdf/grade-groups";
import { formatBytes } from "@/lib/utils/bytes";
import { cn } from "@/lib/utils/cn";
import { gradePath } from "@/lib/utils/routes";

/** Sinf ko'rsatkichlari: faqat haqiqiy ma'lumot (kitoblar soni, umumiy hajm); «Bepul» — platforma qoidasi. */
export function GradeStatsBar({ stats }: { stats: GradeStats }) {
  const t = useTranslations("pdfBooks.grade");
  const items = [
    {
      icon: Library,
      label: t("stats.books"),
      value: t("stats.booksValue", { count: stats.count }),
    },
    ...(stats.totalBytes > 0
      ? [{ icon: HardDrive, label: t("stats.size"), value: formatBytes(stats.totalBytes) }]
      : []),
    { icon: BadgeCheck, label: t("stats.free"), value: t("stats.freeValue") },
  ];
  return (
    <dl
      aria-label={t("statsLabel")}
      data-testid="grade-stats"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3"
    >
      {items.map(({ icon: Icon, label, value }) => (
        <div
          key={label}
          className="border-border bg-surface flex flex-col gap-1 rounded-xl border p-3"
        >
          <dt className="text-muted flex items-center gap-1.5 text-xs">
            <Icon className="text-link size-4 shrink-0" aria-hidden />
            {label}
          </dt>
          <dd className="truncate text-base font-semibold tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Barcha sinflarga tez o'tish: boshlang'ich 1–4, o'rta 5–9, yuqori 10–11. */
export function AllGrades({ current }: { current?: number }) {
  const t = useTranslations("pdfBooks.grade.allGrades");
  return (
    <section aria-labelledby="all-grades" className="flex flex-col gap-4" data-testid="all-grades">
      <h2 id="all-grades" className="text-xl font-semibold tracking-tight">
        {t("title")}
      </h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {GRADE_STAGES.map((stage) => (
          <div key={stage.key} className="flex flex-col gap-2">
            <h3 className="text-muted text-sm font-medium">{t(`stages.${stage.key}`)}</h3>
            <ul className="flex flex-wrap gap-2">
              {stage.grades.map((grade) => (
                <li key={grade}>
                  <Link
                    href={gradePath(grade)}
                    aria-current={grade === current ? "page" : undefined}
                    className={cn(
                      "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border px-3 text-sm font-medium tabular-nums transition-colors sm:min-h-10 sm:min-w-10",
                      grade === current
                        ? "border-primary-600 bg-primary-600 text-white"
                        : "border-border bg-surface hover:border-primary-300 hover:bg-subtle",
                    )}
                  >
                    {t("label", { grade })}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

const STEPS = [
  { key: "choose", icon: MousePointerClick },
  { key: "open", icon: BookOpen },
  { key: "read", icon: Download },
] as const;

/** «Qanday foydalanish»: 3 qadam. */
export function HowTo() {
  const t = useTranslations("pdfBooks.grade.howTo");
  return (
    <section aria-labelledby="how-to" className="flex flex-col gap-4">
      <h2 id="how-to" className="text-xl font-semibold tracking-tight">
        {t("title")}
      </h2>
      <ol className="grid gap-3 sm:grid-cols-3">
        {STEPS.map(({ key, icon: Icon }, index) => (
          <li key={key} className="border-border bg-surface flex gap-3 rounded-xl border p-4">
            <span className="bg-primary-600 flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white tabular-nums">
              {index + 1}
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <h3 className="flex items-center gap-1.5 font-semibold">
                <Icon className="text-link size-4 shrink-0" aria-hidden />
                {t(`steps.${key}.title`)}
              </h3>
              <p className="text-muted text-sm text-pretty">{t(`steps.${key}.text`)}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
