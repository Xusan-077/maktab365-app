import { useTranslations } from "next-intl";
import { Breadcrumbs } from "./Breadcrumbs";
import { ROUTES } from "@/lib/utils/routes";

export type LegalKind = "terms" | "privacy";

/**
 * Oddiy matn sahifasi (Foydalanish shartlari, Maxfiylik siyosati). Matn `legal.<kind>.body` da,
 * bo'sh qator (`\n\n`) bilan ajratilgan xatboshilar; hozir `[TO'LDIRILADI]` placeholder.
 */
export function LegalPage({ kind }: { kind: LegalKind }) {
  const t = useTranslations("legal");
  const tn = useTranslations("nav");
  const paragraphs = t(`${kind}.body`)
    .split(/\n{2,}/)
    .map((text) => text.trim())
    .filter(Boolean);

  return (
    <div className="max-w-site mx-auto flex flex-col gap-8 px-4 py-12 sm:px-8 sm:py-14">
      <div className="flex flex-col gap-2.5">
        <Breadcrumbs
          items={[{ label: tn("home"), href: ROUTES.home }, { label: t(`${kind}.title`) }]}
        />
        <h1 className="text-[2rem] font-extrabold tracking-[-0.03em] sm:text-[2.75rem]">
          {t(`${kind}.title`)}
        </h1>
      </div>
      <div className="text-muted flex max-w-[70ch] flex-col gap-4 text-[1.0625rem] leading-relaxed">
        {paragraphs.map((text, index) => (
          <p key={index}>{text}</p>
        ))}
      </div>
    </div>
  );
}
