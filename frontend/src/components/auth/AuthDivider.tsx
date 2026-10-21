import { useTranslations } from "next-intl";

/** "—— yoki ——" ajratgichi. */
export function AuthDivider() {
  const t = useTranslations("authForm");
  return (
    <div className="text-muted flex items-center gap-3 text-sm" aria-hidden>
      <span className="bg-border h-px flex-1" />
      {t("or")}
      <span className="bg-border h-px flex-1" />
    </div>
  );
}
