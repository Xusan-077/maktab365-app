import { getTranslations } from "next-intl/server";
import { catalogPath, ROUTES, subjectsPath, type AppBase } from "@/lib/utils/routes";
import type { BreadcrumbItem } from "./Breadcrumbs";

export { pageShellClass } from "./containers";

/** Katalogning o'zi (panelda bosh sahifa) — zanjirning boshi: marketingda "Bosh sahifa", panelda "Darsliklar". */
export async function getRootCrumb(base: AppBase): Promise<BreadcrumbItem> {
  if (base === "marketing") {
    const tb = await getTranslations("breadcrumb");
    return { label: tb("home"), href: ROUTES.home };
  }
  const tn = await getTranslations("nav");
  return { label: tn("textbooks"), href: catalogPath(base) };
}

/** Fan sahifasidan oldingi "Fanlar" bo'g'ini: marketing → Fanlar, kabinet → Fanlarim, ustoz → Darsliklar. */
export async function getSubjectsCrumb(base: AppBase): Promise<BreadcrumbItem> {
  if (base === "marketing") {
    const t = await getTranslations("subjectsPage");
    return { label: t("title"), href: subjectsPath(base) };
  }
  if (base === "kabinet") {
    const t = await getTranslations("cabinet.nav");
    return { label: t("subjects"), href: subjectsPath(base) };
  }
  return getRootCrumb(base);
}

/** Sinf bo'g'ini: katalogni shu sinf bo'yicha filtrlaydi (ustoz panelida filtr URL'da emas, shuning uchun yo'q). */
export async function getGradeCrumb(base: AppBase, grade: number): Promise<BreadcrumbItem | null> {
  if (base === "ustoz") return null;
  const tg = await getTranslations("home.grades");
  return { label: tg("chip", { grade }), href: `${catalogPath(base)}?grade=${grade}` };
}
