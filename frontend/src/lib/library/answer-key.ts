import { ApiError } from "@/lib/api/types";

/** Test kitob javoblar kaliti (admin): matn ↔ qatorlar va server xatolarini o'qish. Sof mantiq. */

export interface KeyRow {
  page: number;
  question: number;
  answer: string;
}

export interface KeyLineError {
  /** Matndagi qator raqami (1 dan); umumiy xato (masalan, juda ko'p qator) uchun 0. */
  line: number;
  code: string;
}

/** Kalitni tahrirlash uchun matn: har qator `bet, savol, javob`. */
export function keyToText(rows: readonly KeyRow[]): string {
  return rows.map((row) => `${row.page}, ${row.question}, ${row.answer}`).join("\n");
}

/** Matndagi bo'sh bo'lmagan, izoh (`#`) bo'lmagan qatorlar soni (taxminiy, serverda aniqlanadi). */
export function countKeyLines(text: string): number {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#")).length;
}

/** Server `details.text`: `["2: page_out_of_range", ...]` → qator va kod. Tushunarsiz yozuv tashlanadi. */
export function keyErrors(error: unknown): KeyLineError[] {
  if (!(error instanceof ApiError)) return [];
  const rows = error.details?.text ?? [];
  return rows.flatMap((row) => {
    const match = /^(\d+):\s*([a-z_]+)$/.exec(row);
    return match ? [{ line: Number(match[1]), code: match[2] }] : [];
  });
}

/** Qatorli bo'lmagan xato kodi (`empty`, `not_test_book`…). */
export function keyErrorCode(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  const single = error.details?.text?.find((row) => !/^\d+:/.test(row));
  if (single) return single;
  return error.details?.detail?.[0] ?? null;
}
