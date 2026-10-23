import { useTranslations } from "next-intl";
import { coverTone } from "@/lib/pdf/cover-theme";
import { cn } from "@/lib/utils/cn";

export interface GeneratedCoverProps {
  grade: number;
  /** Fan slug'i: rang guruhini belgilaydi (noma'lum fan — nom xeshiga ko'ra barqaror rang). */
  subject: string;
  /** Muqovada ko'rinadigan fan nomi (tanlangan tilda). */
  subjectTitle: string;
  className?: string;
}

/**
 * Kitobning o'z muqovasi bo'lmaganda chiziladigan generativ muqova: fan guruhi rangidagi gradient,
 * katta sinf raqami, fan nomi. Faqat CSS (`.cover` — `globals.css`), o'lchamga qarab o'zi masshtablanadi
 * (container query birliklari). Bezak: ekran o'qigichlardan yashirilgan, kartaning matni bor.
 */
export function GeneratedCover({ grade, subject, subjectTitle, className }: GeneratedCoverProps) {
  const t = useTranslations("pdfBooks.cover");
  return (
    <div
      aria-hidden
      data-testid="generated-cover"
      data-tone={coverTone(subject)}
      className={cn("cover aspect-[3/4] rounded-md", className)}
    >
      <div className="cover-content">
        <div className="cover-top">
          <span>{t("textbook")}</span>
          <span className="cover-pill">{t("pdf")}</span>
        </div>
        <div>
          <div className="cover-grade">{grade}</div>
          <div className="cover-grade-label">{t("grade")}</div>
        </div>
        <div className="cover-subject">{subjectTitle}</div>
      </div>
      <span className="cover-edge" />
      <span className="cover-shine" />
    </div>
  );
}
