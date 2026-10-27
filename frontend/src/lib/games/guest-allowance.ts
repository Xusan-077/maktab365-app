import { FREE_GAMES_PER_MONTH } from "./config";

/**
 * Mehmon (kirmagan) uchun oylik bepul o'yinlar: faqat shu brauzerda (`localStorage`), oy backend
 * kabi Toshkent vaqti bilan. Haqiqiy cheklov emas (tozalab yuborish mumkin) — kirganda server sanaydi.
 */
export const GUEST_ALLOWANCE_STORAGE_KEY = "maktab365-games-guest";

export interface GuestAllowanceRecord {
  /** `2026-10` */
  month: string;
  used: number;
}

export interface GuestAllowance {
  limit: number;
  used: number;
  left: number;
}

/** Toshkent UTC+5, yozgi vaqt yo'q. */
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

export function monthKey(now: Date): string {
  const local = new Date(now.getTime() + TASHKENT_OFFSET_MS);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function parseGuestRecord(raw: unknown): GuestAllowanceRecord | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { month, used } = raw as Partial<GuestAllowanceRecord>;
  if (typeof month !== "string" || !/^\d{4}-\d{2}$/.test(month)) return null;
  if (typeof used !== "number" || !Number.isInteger(used) || used < 0) return null;
  return { month, used };
}

/** Joriy oy holati: boshqa oyning yozuvi hisobga olinmaydi (yangi oy — yana 10 ta). */
export function guestAllowance(
  record: GuestAllowanceRecord | null,
  now: Date,
  limit = FREE_GAMES_PER_MONTH,
): GuestAllowance {
  const used = record && record.month === monthKey(now) ? Math.min(record.used, limit) : 0;
  return { limit, used, left: limit - used };
}

/** Bitta o'yin sarflaydi; limit tugagan bo'lsa `null`. */
export function consumeGuest(
  record: GuestAllowanceRecord | null,
  now: Date,
  limit = FREE_GAMES_PER_MONTH,
): GuestAllowanceRecord | null {
  const { used, left } = guestAllowance(record, now, limit);
  if (left <= 0) return null;
  return { month: monthKey(now), used: used + 1 };
}

export function readGuestRecord(): GuestAllowanceRecord | null {
  try {
    const raw = localStorage.getItem(GUEST_ALLOWANCE_STORAGE_KEY);
    return raw ? parseGuestRecord(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function writeGuestRecord(record: GuestAllowanceRecord): void {
  try {
    localStorage.setItem(GUEST_ALLOWANCE_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Saqlash taqiqlangan (private rejim) — limit shu sahifa davomida hisoblanmaydi.
  }
}
