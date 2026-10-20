/** Email kodi (OTP) uchun sof yordamchilar (komponent va testlar umumiy ishlatadi). */

export const OTP_LENGTH = 6;
/** Backend qayta so'rash cooldown'i bilan bir xil (`OTP_RESEND_COOLDOWN_SECONDS`). */
export const OTP_RESEND_SECONDS = 60;

export type OtpCells = string[];

export const emptyCells = (): OtpCells => Array.from({ length: OTP_LENGTH }, () => "");

export const digitsOf = (value: string) => value.replace(/\D/g, "");

export interface CellsUpdate {
  cells: OtpCells;
  /** Keyingi fokus katagi (0…OTP_LENGTH-1). */
  focus: number;
}

/**
 * `index` katagiga raqam(lar) kiritildi. Bitta raqam — shu katak; ko'p raqam (qo'yish, SMS/email
 * avtoto'ldirish) — `index` dan boshlab keyingi kataklarga yoyiladi. Raqam bo'lmagan belgilar tashlanadi.
 */
export function applyInput(cells: OtpCells, index: number, input: string): CellsUpdate {
  const digits = digitsOf(input);
  if (!digits) return { cells, focus: index };
  const next = [...cells];
  const chars = digits.slice(0, OTP_LENGTH - index).split("");
  chars.forEach((char, offset) => {
    next[index + offset] = char;
  });
  return { cells: next, focus: Math.min(index + chars.length, OTP_LENGTH - 1) };
}

/** Backspace: to'la katak tozalanadi; bo'sh katakda oldingisi tozalanib, fokus orqaga o'tadi. */
export function applyBackspace(cells: OtpCells, index: number): CellsUpdate {
  const next = [...cells];
  if (next[index]) {
    next[index] = "";
    return { cells: next, focus: index };
  }
  const previous = Math.max(index - 1, 0);
  next[previous] = "";
  return { cells: next, focus: previous };
}

export const codeOf = (cells: OtpCells) => cells.join("");

export const isComplete = (cells: OtpCells) => codeOf(cells).length === OTP_LENGTH;
