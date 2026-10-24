import { isUuid } from "@/lib/admin/ids";
import { parseGradeParam } from "./grade-groups";
import { readerPath, ROUTES } from "@/lib/utils/routes";

/** Tilsiz yo'l `/darsliklar/<uuid>` bo'lsa uuid (eski o'qish manzili), aks holda `null`. */
export function legacyBookId(path: string): string | null {
  const match = /^\/darsliklar\/([^/]+)\/?$/.exec(path);
  return match && isUuid(match[1]) ? match[1] : null;
}

/**
 * Eski `/darsliklar?grade=9` → `/darsliklar?sinf=9` (qolgan parametrlar saqlanadi, `grade` olinadi).
 * Yangi manzil kerak bo'lmasa `null`.
 */
export function legacyGradeRedirect(path: string, search: string): string | null {
  if (path !== "/darsliklar" && path !== "/darsliklar/") return null;
  const params = new URLSearchParams(search);
  const grade = parseGradeParam(params.get("grade") ?? "");
  if (grade === null) return null;
  params.delete("grade");
  params.delete("page");
  params.set("sinf", String(grade));
  return `${ROUTES.textbooks}?${params.toString()}`;
}

/** Eski uuid manzili bo'yicha topilgan kitobdan yangi o'qish manzili (`?page=` saqlanadi). */
export function legacyBookTarget(book: { grade: number; slug: string }, search: string): string {
  const raw = new URLSearchParams(search).get("page");
  const page = raw && /^\d+$/.test(raw) ? Number(raw) : undefined;
  const path = readerPath(book, page);
  const params = new URLSearchParams(search);
  params.delete("page");
  const rest = params.toString();
  if (!rest) return path;
  return `${path}${path.includes("?") ? "&" : "?"}${rest}`;
}
