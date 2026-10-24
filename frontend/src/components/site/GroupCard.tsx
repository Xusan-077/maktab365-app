import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import type { SubjectGroup } from "@/lib/pdf/grade-groups";
import { groupColor } from "@/lib/subject-colors";
import { cn } from "@/lib/utils/cn";

export interface GroupCardProps {
  group: SubjectGroup;
  /** Yo'nalishdagi fanlar soni (API'dan). */
  subjectCount: number;
  href: string;
  className?: string;
}

/** Bosh sahifadagi "Fan yo'nalishlari" kartasi: nom va namuna fanlar i18n'dan, soni API'dan. */
export function GroupCard({ group, subjectCount, href, className }: GroupCardProps) {
  const t = useTranslations("site");
  const color = groupColor(group);
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
      <span className="text-muted text-sm leading-normal">{t(`groupSample.${group}`)}</span>
      <span className={cn("mt-auto text-sm font-semibold", color.text)}>
        {t("subjectCount", { count: subjectCount })}
      </span>
    </Link>
  );
}
