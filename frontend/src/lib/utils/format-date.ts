import type { Locale } from "@/lib/i18n/config";

/** Saytdagi barcha vaqtlar shu mintaqada ko'rsatiladi (API UTC qaytaradi). */
export const DISPLAY_TIME_ZONE = "Asia/Tashkent";

/**
 * `date` — "24-oktabr, 2026"; `dateTime` — "24-okt, 18:03"; `dayMonth` — "24-okt"; `time` — "18:03".
 */
export type DateStyle = "date" | "dateTime" | "dayMonth" | "time";

const UZ_MONTHS = [
  "yanvar",
  "fevral",
  "mart",
  "aprel",
  "may",
  "iyun",
  "iyul",
  "avgust",
  "sentabr",
  "oktabr",
  "noyabr",
  "dekabr",
] as const;
const UZ_MONTHS_SHORT = [
  "yan",
  "fev",
  "mar",
  "apr",
  "may",
  "iyun",
  "iyul",
  "avg",
  "sen",
  "okt",
  "noy",
  "dek",
] as const;

const INTL_OPTIONS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  date: { day: "numeric", month: "long", year: "numeric" },
  dateTime: {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  },
  dayMonth: { day: "numeric", month: "short" },
  time: { hour: "2-digit", minute: "2-digit", hourCycle: "h23" },
};

/** `2026-10-24` — kalendar sanasi (vaqtsiz): mintaqaga o'girilmaydi, aks holda kun siljiydi. */
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(locale: string, timeZone: string, options: Intl.DateTimeFormatOptions) {
  const key = `${locale}|${timeZone}|${JSON.stringify(options)}`;
  let cached = formatters.get(key);
  if (!cached) {
    cached = new Intl.DateTimeFormat(locale, { ...options, timeZone });
    formatters.set(key, cached);
  }
  return cached;
}

/** Berilgan mintaqadagi sana qismlari (raqamlar; brauzer locale ma'lumotiga bog'liq emas). */
function partsIn(date: Date, timeZone: string) {
  const parts = formatter("en-US", timeZone, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    year: get("year"),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: get("hour").padStart(2, "0"),
    minute: get("minute").padStart(2, "0"),
  };
}

/**
 * Saytdagi yagona sana formatlagich: API'dan kelgan UTC ISO (yoki `Date`) bir marta
 * `Asia/Tashkent` ga o'giriladi. `uz` — qo'lda ("24-oktabr, 2026"; brauzerlarning `uz` ICU
 * ma'lumoti "2026 M10 24" beradi), `uz-Cyrl`/`ru`/`en` — `Intl`. Yaroqsiz qiymatda `""`.
 */
export function formatDate(
  value: string | Date | null | undefined,
  locale: Locale,
  style: DateStyle,
): string {
  if (!value) return "";
  const calendar = typeof value === "string" && CALENDAR_DATE.test(value);
  const date =
    typeof value === "string" ? new Date(calendar ? `${value}T00:00:00Z` : value) : value;
  if (Number.isNaN(date.getTime())) return "";
  const timeZone = calendar ? "UTC" : DISPLAY_TIME_ZONE;

  if (style === "time") {
    const { hour, minute } = partsIn(date, timeZone);
    return `${hour}:${minute}`;
  }
  if (locale !== "uz") return formatter(locale, timeZone, INTL_OPTIONS[style]).format(date);

  const { year, month, day, hour, minute } = partsIn(date, timeZone);
  if (style === "date") return `${day}-${UZ_MONTHS[month - 1]}, ${year}`;
  if (style === "dayMonth") return `${day}-${UZ_MONTHS_SHORT[month - 1]}`;
  return `${day}-${UZ_MONTHS_SHORT[month - 1]}, ${hour}:${minute}`;
}

/**
 * `value` `now` dan necha kalendar kun oldin (Toshkent vaqtida): 0 — bugun, 1 — kecha; yaroqsiz
 * qiymatda `null`. "Bugun 09:41" / "Kecha" kabi nisbiy yozuvlar uchun.
 */
export function daysAgo(value: string | Date | null | undefined, now: Date = new Date()) {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  const day = (d: Date) => {
    const { year, month, day } = partsIn(d, DISPLAY_TIME_ZONE);
    return Date.UTC(Number(year), month - 1, day);
  };
  return Math.round((day(now) - day(date)) / 86_400_000);
}
