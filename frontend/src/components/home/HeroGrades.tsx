"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { ROUTES } from "@/lib/utils/routes";
import { GRADES } from "@/types/catalog";
import { useHeroGrade } from "./HeroStage";

/** Sinf tugmalari: ustiga kelinganda/fokusda o'ng tomondagi muqovalar shu sinfga o'tadi. */
export function HeroGrades() {
  const tg = useTranslations("pdfBooks.catalog");
  const { grade: active, setGrade } = useHeroGrade();

  return (
    <ul className="flex flex-wrap gap-2" onPointerLeave={() => setGrade(null)}>
      {GRADES.map((grade, index) => (
        <li key={grade} className="hero-chip" style={{ "--c": index } as CSSProperties}>
          <Link
            href={`${ROUTES.textbooks}?grade=${grade}`}
            aria-label={tg("gradeLabel", { grade })}
            onPointerEnter={() => setGrade(grade)}
            onFocus={() => setGrade(grade)}
            onBlur={() => setGrade(null)}
            data-active={active === grade}
            className={cn(
              "border-border bg-surface inline-flex size-11 items-center justify-center rounded-full border text-sm font-semibold tabular-nums shadow-xs transition-[transform,background-color,border-color,color,box-shadow] duration-200",
              "hover:border-primary-400 hover:bg-primary-soft hover:text-primary-soft-foreground hover:-translate-y-1 hover:scale-110 hover:shadow-md active:scale-95",
              "data-[active=true]:border-primary-400 data-[active=true]:bg-primary-soft data-[active=true]:text-primary-soft-foreground",
            )}
          >
            {grade}
          </Link>
        </li>
      ))}
    </ul>
  );
}
