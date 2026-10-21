import type { BookListParams } from "./types";

type Raw = { get(name: string): string | null };

const GRADE_MIN = 1;
const GRADE_MAX = 11;
const ORDERINGS = ["grade", "-grade", "slug", "-slug", "-updated_at", "updated_at"] as const;

function positiveInt(value: string | null): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const n = Number(value);
  return n >= 1 ? n : undefined;
}

/** URL search params → kitoblar ro'yxati so'rovi (noto'g'ri qiymatlar tashlab yuboriladi). */
export function parseBookParams(params: Raw): BookListParams {
  const grade = positiveInt(params.get("grade"));
  const status = params.get("status");
  const ordering = params.get("ordering");
  return {
    page: positiveInt(params.get("page")),
    search: params.get("q")?.trim() || undefined,
    grade: grade !== undefined && grade >= GRADE_MIN && grade <= GRADE_MAX ? grade : undefined,
    subject: params.get("subject")?.trim() || undefined,
    status: status === "published" || status === "draft" ? status : undefined,
    ordering: ORDERINGS.find((o) => o === ordering),
  };
}

/** So'rov → URL query (bo'sh qiymatlar yo'q; 1-sahifa yozilmaydi). */
export function serializeBookParams(params: BookListParams): string {
  const query = new URLSearchParams();
  if (params.search) query.set("q", params.search);
  if (params.grade) query.set("grade", String(params.grade));
  if (params.subject) query.set("subject", params.subject);
  if (params.status) query.set("status", params.status);
  if (params.ordering) query.set("ordering", params.ordering);
  if (params.page && params.page > 1) query.set("page", String(params.page));
  return query.toString();
}

/** Filtr o'zgarganda sahifa 1 ga qaytadi. */
export function withFilter(params: BookListParams, patch: Partial<BookListParams>): BookListParams {
  return { ...params, ...patch, page: patch.page };
}
