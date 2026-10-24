import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { gradePath } from "@/lib/utils/routes";

export interface GradeTileProps {
  grade: number;
  /** Shu sinfdagi fanlar soni (API'dan); berilmasa ko'rsatilmaydi. */
  subjectCount?: number;
  /** `tile` — katta kartochka (bosh sahifa); `button` — 44×44 raqam tugmasi (hero). */
  variant?: "tile" | "button";
  href?: string;
  className?: string;
}

/** 1–4-sinflar iliq (boshlang'ich), qolganlari brend ko'ki. */
const isPrimarySchool = (grade: number) => grade <= 4;

export function GradeTile({
  grade,
  subjectCount,
  variant = "tile",
  href = gradePath(grade),
  className,
}: GradeTileProps) {
  const t = useTranslations("site");

  if (variant === "button") {
    return (
      <Link
        href={href}
        aria-label={t("gradeLabel", { grade })}
        className={cn(
          "bg-surface border-input-border text-foreground hover:border-brand hover:bg-brand-soft flex size-11 items-center justify-center rounded-xl border text-base font-bold transition-colors",
          className,
        )}
      >
        {grade}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "border-border text-foreground flex flex-col gap-3.5 rounded-[1.125rem] border p-[1.125rem] transition-shadow hover:shadow-md",
        isPrimarySchool(grade) ? "bg-warm-soft" : "bg-hero-bg",
        className,
      )}
    >
      <span className="flex items-baseline gap-1.5">
        <span
          className={cn(
            "text-[2.75rem] leading-none font-extrabold tracking-[-0.03em]",
            isPrimarySchool(grade) ? "text-group-language" : "text-brand-text",
          )}
        >
          {grade}
        </span>
        <span className="text-[0.9375rem] font-semibold">{t("gradeWord")}</span>
      </span>
      {subjectCount !== undefined && (
        <span className="text-muted text-sm">{t("subjectCount", { count: subjectCount })}</span>
      )}
    </Link>
  );
}
