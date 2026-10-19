import { useTranslations } from "next-intl";

export const MAIN_CONTENT_ID = "main-content";

export function SkipLink() {
  const t = useTranslations("a11y");
  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      className="bg-primary-600 sr-only rounded-lg px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[80] print:hidden"
    >
      {t("skipToContent")}
    </a>
  );
}
