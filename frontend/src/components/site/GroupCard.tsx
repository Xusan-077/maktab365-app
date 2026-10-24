import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import type { SubjectGroup } from "@/lib/pdf/grade-groups";
import type { PdfSubject } from "@/lib/pdf-books/api";
import { groupColor } from "@/lib/subject-colors";
import { cn } from "@/lib/utils/cn";

export interface GroupCardProps {
  group: SubjectGroup;
  /**
   * Yo'nalishning kitobi bor fanlari (API'dan, `groupSubjects`): soni ham, tavsifdagi nomlar ham
   * shulardan — son va matn bir-biriga zid bo'lmaydi. `null` — API javob bermadi (son ham, matn ham yo'q).
   */
  subjects: readonly Pick<PdfSubject, "slug" | "title">[] | null;
  href: string;
  className?: string;
}

/** Tavsifda shuncha fan nomi, qolgani "va yana N ta". */
const SHOWN_SUBJECTS = 3;

/** Bosh sahifadagi "Fan yo'nalishlari" kartasi: nom i18n'dan, fanlar ro'yxati va soni bazadan. */
export function GroupCard({ group, subjects, href, className }: GroupCardProps) {
  const t = useTranslations("site");
  const locale = useLocale() as Locale;
  const color = groupColor(group);
  const names = (subjects ?? []).map((subject) => getLocalized(subject.title, locale));
  const shown = names.slice(0, SHOWN_SUBJECTS).join(", ");
  const rest = names.length - SHOWN_SUBJECTS;
  let description: string | null = null;
  if (subjects !== null) {
    if (names.length === 0) description = t("comingSoon");
    else description = rest > 0 ? t("subjectsMore", { list: shown, count: rest }) : shown;
  }
  return (
    <Link
      href={href}
      className={cn(
        "border-border bg-surface text-foreground flex min-h-[11.875rem] flex-col gap-4 rounded-[1.25rem] border p-[1.375rem] transition-shadow hover:shadow-md",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "text-on-group flex size-12 items-center justify-center rounded-[0.875rem] text-xl font-extrabold",
          color.solid,
        )}
      >
        {t(`groupLetter.${group}`)}
      </span>
      <span className="text-[1.1875rem] font-bold">{t(`groupName.${group}`)}</span>
      {description && (
        <span className="text-muted text-sm leading-normal" data-testid="group-subjects">
          {description}
        </span>
      )}
      {subjects !== null && (
        <span className={cn("mt-auto text-sm font-semibold", color.text)}>
          {t("subjectCount", { count: subjects.length })}
        </span>
      )}
    </Link>
  );
}
