/**
 * Mavzu tizimi olib tashlanishidan oldin brauzerda qolgan kalitlar: mehmon mavzu progressi va
 * xatcho'plari, o'qish pozitsiyalari, oflayn yozuvlar navbati (`maktab365-sync:<foydalanuvchi>`),
 * o'yinlardagi eski mehmon hisobi.
 * Ularga endi hech narsa tayanmaydi, shuning uchun bir marta o'chiriladi.
 */
const LEGACY_KEYS = ["maktab365-guest", "maktab365-reading", "maktab365-games-guest"] as const;
const LEGACY_PREFIXES = ["maktab365-sync:"] as const;

type LegacyStorage = Pick<Storage, "length" | "key" | "removeItem">;

/** O'chirilgan kalitlar soni. Xotira yo'q yoki bloklangan bo'lsa jim o'tadi. */
export function clearLegacyStorage(
  storage: LegacyStorage | undefined = typeof localStorage === "undefined"
    ? undefined
    : localStorage,
): number {
  if (!storage) return 0;
  try {
    const stale: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (
        key &&
        ((LEGACY_KEYS as readonly string[]).includes(key) ||
          LEGACY_PREFIXES.some((prefix) => key.startsWith(prefix)))
      ) {
        stale.push(key);
      }
    }
    for (const key of stale) storage.removeItem(key);
    return stale.length;
  } catch {
    return 0;
  }
}
