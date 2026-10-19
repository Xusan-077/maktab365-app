export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  /** Qidiruvda qo'shimcha moslashadigan so'zlar (masalan, boshqa tildagi nom). */
  keywords?: string;
}

export const TYPEAHEAD_RESET_MS = 700;

const norm = (text: string) => text.toLocaleLowerCase();

/** Qidiruv: yorliq yoki kalit so'zlarda katta-kichik harfga e'tiborsiz moslik. Bo'sh so'rov — hammasi. */
export function filterOptions(options: SelectOption[], query: string): SelectOption[] {
  const needle = norm(query.trim());
  if (!needle) return options;
  return options.filter((option) =>
    norm(`${option.label} ${option.keywords ?? ""}`).includes(needle),
  );
}

export function firstEnabled(options: SelectOption[]): number {
  return options.findIndex((option) => !option.disabled);
}

export function lastEnabled(options: SelectOption[]): number {
  return options.findLastIndex((option) => !option.disabled);
}

/** Ochilganda faol bo'ladigan variant: tanlanganning birinchisi, bo'lmasa birinchi faol variant. */
export function initialActiveIndex(options: SelectOption[], selected: string[]): number {
  const index = options.findIndex((option) => !option.disabled && selected.includes(option.value));
  return index >= 0 ? index : firstEnabled(options);
}

const PAGE_STEP = 10;

export type NavKey = "ArrowDown" | "ArrowUp" | "Home" | "End" | "PageDown" | "PageUp";

function step(options: SelectOption[], from: number, direction: 1 | -1, count: number): number {
  let index = from;
  for (let moved = 0; moved < count;) {
    const next = index + direction;
    if (next < 0 || next >= options.length) break;
    index = next;
    if (!options[index].disabled) moved += 1;
  }
  return index;
}

/** Strelkalar/Home/End/PageUp/PageDown: o'chirilgan variantlarni o'tkazib yuboradi, chetda to'xtaydi. */
export function moveActive(options: SelectOption[], active: number, key: NavKey): number {
  if (firstEnabled(options) < 0) return -1;
  switch (key) {
    case "Home":
      return firstEnabled(options);
    case "End":
      return lastEnabled(options);
    case "ArrowDown":
      return active < 0 ? firstEnabled(options) : step(options, active, 1, 1);
    case "ArrowUp":
      return active < 0 ? lastEnabled(options) : step(options, active, -1, 1);
    case "PageDown":
      return active < 0 ? firstEnabled(options) : step(options, active, 1, PAGE_STEP);
    case "PageUp":
      return active < 0 ? lastEnabled(options) : step(options, active, -1, PAGE_STEP);
  }
}

export interface TypeaheadState {
  buffer: string;
  at: number;
}

/** Harf bosilganda bufer: pauza (700 ms) dan keyin yangidan boshlanadi. */
export function nextTypeahead(prev: TypeaheadState, char: string, now: number): TypeaheadState {
  const fresh = now - prev.at > TYPEAHEAD_RESET_MS;
  return { buffer: (fresh ? "" : prev.buffer) + norm(char), at: now };
}

/**
 * Buferga mos variant indeksi (topilmasa -1). Bir xil harf takrorlansa ("ss"), shu harfdan
 * boshlanuvchi variantlar bo'ylab aylanadi; aks holda joriy variantdan boshlab prefiks qidiriladi.
 */
export function findTypeaheadMatch(
  options: SelectOption[],
  buffer: string,
  active: number,
): number {
  if (!buffer) return -1;
  const cycling = [...buffer].every((char) => char === buffer[0]);
  const prefix = cycling ? buffer[0] : buffer;
  const start = cycling ? active + 1 : Math.max(active, 0);
  for (let offset = 0; offset < options.length; offset += 1) {
    const index = (start + offset) % options.length;
    const option = options[index];
    if (!option.disabled && norm(option.label).startsWith(prefix)) return index;
  }
  return -1;
}

/** Bosilganda yozuv kiritadigan belgi (Ctrl/Alt/Meta siz, bitta belgi, bo'shliqdan tashqari). */
export function isTypeaheadKey(event: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}): boolean {
  return (
    event.key.length === 1 && event.key !== " " && !event.ctrlKey && !event.metaKey && !event.altKey
  );
}

export interface ListKeyContext {
  options: SelectOption[];
  active: number;
  /** Qidiruv maydoni fokusda: bo'shliq va Home/End matn tahririga tegishli. */
  searching: boolean;
}

export type ListKeyResult =
  { type: "move"; active: number } | { type: "select" } | { type: "close" } | { type: "tab" };

/** Ochiq ro'yxatdagi klaviatura: tanlash (Enter/Bo'shliq), yopish (Esc/Tab) va harakat. `null` — bu tugma bizniki emas. */
export function resolveListKey(key: string, context: ListKeyContext): ListKeyResult | null {
  const { options, active, searching } = context;
  switch (key) {
    case "ArrowDown":
    case "ArrowUp":
    case "PageDown":
    case "PageUp":
      return { type: "move", active: moveActive(options, active, key) };
    case "Home":
    case "End":
      return searching ? null : { type: "move", active: moveActive(options, active, key) };
    case "Enter":
      return { type: "select" };
    case " ":
      return searching ? null : { type: "select" };
    case "Escape":
      return { type: "close" };
    case "Tab":
      return { type: "tab" };
    default:
      return null;
  }
}

/** Ko'p tanlovda qiymatni qo'shadi/olib tashlaydi; natija har doim variantlar tartibida. */
export function toggleMulti(values: string[], value: string, options: SelectOption[]): string[] {
  const next = values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
  const order = new Map(options.map((option, index) => [option.value, index]));
  return next.sort((a, b) => (order.get(a) ?? Infinity) - (order.get(b) ?? Infinity));
}
