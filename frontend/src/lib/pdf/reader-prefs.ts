/**
 * O'qish oynasi qulayliklari: sahifa fon rejimi, o'qish rejimi, qisqa tugmalar (sof mantiq; zoom —
 * `zoom.ts`, rejimlar — `reading-mode.ts`).
 */

import { isReadingMode, type ReadingMode } from "./reading-mode";

export const READER_TONES = ["light", "sepia", "dark"] as const;
export type ReaderTone = (typeof READER_TONES)[number];

export interface ReaderPrefs {
  tone: ReaderTone;
  /** Foydalanuvchi tanlagan o'qish rejimi; `null` — qurilma bo'yicha standart. */
  mode: ReadingMode | null;
}

export const DEFAULT_READER_PREFS: ReaderPrefs = { tone: "light", mode: null };

export function nextTone(tone: ReaderTone): ReaderTone {
  return READER_TONES[(READER_TONES.indexOf(tone) + 1) % READER_TONES.length];
}

/** Xotiradan o'qilgan qiymatlardan faqat yaroqlilari. */
export function sanitizePrefs(value: unknown): ReaderPrefs {
  const raw = (typeof value === "object" && value !== null ? value : {}) as Partial<ReaderPrefs>;
  return {
    tone: READER_TONES.includes(raw.tone as ReaderTone)
      ? (raw.tone as ReaderTone)
      : DEFAULT_READER_PREFS.tone,
    mode: isReadingMode(raw.mode) ? raw.mode : DEFAULT_READER_PREFS.mode,
  };
}

export interface TapPoint {
  x: number;
  y: number;
  at: number;
}

/** Ikki marta bosish: kichik vaqt oralig'ida va bir joyda. */
export const DOUBLE_TAP_MS = 320;
export const DOUBLE_TAP_DISTANCE = 32;

export function isDoubleTap(previous: TapPoint | null, next: TapPoint): boolean {
  if (!previous) return false;
  return (
    next.at - previous.at <= DOUBLE_TAP_MS &&
    Math.hypot(next.x - previous.x, next.y - previous.y) <= DOUBLE_TAP_DISTANCE
  );
}

/** Klaviatura yorliqlari ro'yxati (`pdfBooks.shortcuts.*` kalitlari bilan). */
export const READER_SHORTCUTS = [
  { keys: ["←", "→"], id: "pages" },
  { keys: ["PgUp", "PgDn", "Space"], id: "pagesAlt" },
  { keys: ["Home", "End"], id: "ends" },
  { keys: ["F"], id: "fullscreen" },
  { keys: ["T"], id: "tone" },
  { keys: ["Z"], id: "zoom" },
  { keys: ["Ctrl", "F"], id: "find" },
  { keys: ["?"], id: "help" },
] as const;
