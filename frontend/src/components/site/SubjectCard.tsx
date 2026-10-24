import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { formatGrades } from "@/lib/admin/grades";
import { Link } from "@/lib/i18n/navigation";
import { groupColor } from "@/lib/subject-colors";
import { cn } from "@/lib/utils/cn";

export interface SubjectCardProps {
  href: string;
  name: string;
  /** Backend `subject_group`. */
  group?: string | null;
  /** Fan o'qitiladigan sinflar: "7–11-sinf" ko'rinishida chiqadi. */
  grades: readonly number[];
  className?: string;
}

/** Fanlar sahifasi kartasi: guruh rangidagi bosh harf, nom, sinflar oralig'i. */
export function SubjectCard({ href, name, group, grades, className }: SubjectCardProps) {
  const t = useTranslations("site");
  const color = groupColor(group);
  return (
    <Link
      href={href}
      className={cn(
        "border-border bg-surface text-foreground flex items-center gap-3.5 rounded-2xl border p-4 transition-shadow hover:shadow-md",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-[0.875rem] text-lg font-extrabold",
          color.soft,
          color.text,
        )}
      >
        {name.charAt(0).toLocaleUpperCase()}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-base leading-snug font-bold">{name}</span>
        <span className="text-muted text-sm">
          {t("gradesRange", { range: formatGrades(grades) })}
        </span>
      </span>
      <ChevronRight className="text-placeholder size-[1.125rem] shrink-0" aria-hidden />
    </Link>
  );
}
