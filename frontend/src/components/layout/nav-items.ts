import { ROUTES } from "@/lib/utils/routes";

/** `key` — `nav.*` i18n kaliti. */
export const NAV_ITEMS = [
  { key: "textbooks", href: ROUTES.textbooks },
  { key: "subjects", href: ROUTES.subjects },
  { key: "pdfBooks", href: ROUTES.pdfBooks },
  { key: "about", href: ROUTES.about },
] as const;
