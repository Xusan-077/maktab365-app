"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { GeneratedCover } from "@/components/pdf/GeneratedCover";
import { Link } from "@/lib/i18n/navigation";
import { ROUTES } from "@/lib/utils/routes";
import { useHeroGrade } from "./HeroStage";

/** Bezak muqovalar: har biri shu sinf darsliklari katalogiga olib boradi (soxta kitoblar emas). */
const FAN = [
  { grade: 9, subject: "algebra", rotate: -8, x: -78, lift: 10 },
  { grade: 7, subject: "biologiya", rotate: 0, x: 0, lift: 0 },
  { grade: 8, subject: "tarix", rotate: 8, x: 78, lift: 10 },
] as const;

/** Yelpig'ichdek yoyilgan muqovalar. Sinf tugmasi ustida bo'lsa uchalasi ham shu sinfga o'giriladi. */
export function HeroFan() {
  const t = useTranslations("home.hero");
  const tg = useTranslations("pdfBooks.catalog");
  const { grade: picked } = useHeroGrade();

  return (
    <ul className="hero-tilt absolute inset-0">
      {FAN.map(({ grade: own, subject, rotate, x, lift }, index) => {
        const grade = picked ?? own;
        return (
          <li
            key={subject}
            className="hero-cover absolute top-1/2 left-1/2 w-[42%]"
            style={
              {
                "--rot": `${rotate}deg`,
                "--x": `${x}%`,
                "--y": `${-lift}%`,
                "--n": index,
                zIndex: index === 1 ? 2 : 1,
              } as CSSProperties
            }
          >
            <Link
              href={`${ROUTES.textbooks}?grade=${grade}`}
              aria-label={tg("gradeLabel", { grade })}
              className="hero-float group block rounded-md focus-visible:outline-offset-4"
            >
              <div key={grade} className={picked ? "hero-flip" : undefined}>
                <GeneratedCover
                  grade={grade}
                  subject={subject}
                  subjectTitle={t(`samples.${subject}`)}
                  className="w-full shadow-xl"
                />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
