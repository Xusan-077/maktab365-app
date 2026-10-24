/**
 * Yordam xabari sifati: juda qisqa yoki ma'nosiz matn ("Dnxdnxdnxdnx") yuborilmaydi. Qoidalar
 * backend (`apps/support/quality.py`) bilan bir xil; kontrakt
 * `contracts/fixtures/support-message-quality.json` ikki tomonda tekshiriladi.
 */

export const SUPPORT_MESSAGE_MIN = 15;
/** Kamida shuncha so'z (2+ harf): bitta uzun "so'z" — odatda klaviatura bosish. */
const MIN_WORDS = 2;
/** Harflar bo'shliqsiz belgilarning kamida shu qismi. */
const MIN_LETTER_SHARE = 0.5;
/** Unli harflar ulushi (o'zbek, rus, ingliz matnida doim yuqori). */
const MIN_VOWEL_SHARE = 0.2;
/** Bir xil qisqa bo'lak takrori ("dnx" × 4). */
const MAX_REPEAT_UNIT = 4;
const MIN_REPEATS = 3;
/** 20+ harfli "so'z" — bo'shliqsiz yozilgan gap yoki tasodifiy belgilar. */
const MAX_WORD_LENGTH = 20;

const VOWELS = new Set("aeiouyаеёиоуыэюяўі");
const LETTER = /\p{L}/gu;
const WORD = /\p{L}{2,}/gu;

function repeatsUnit(letters: string): boolean {
  for (let size = 1; size <= MAX_REPEAT_UNIT; size += 1) {
    const unit = letters.slice(0, size);
    const times = Math.floor(letters.length / size);
    if (times >= MIN_REPEATS && unit.repeat(times + 1).slice(0, letters.length) === letters) {
      return true;
    }
  }
  return false;
}

export function isMeaningless(text: string): boolean {
  const lowered = text.trim().toLowerCase();
  const compact = lowered.replace(/\s+/g, "");
  const letters = (lowered.match(LETTER) ?? []).join("");
  if (!compact || letters.length / compact.length < MIN_LETTER_SHARE) return true;
  const words = lowered.match(WORD) ?? [];
  if (words.length < MIN_WORDS || new Set(words).size === 1) return true;
  if (words.some((word) => word.length >= MAX_WORD_LENGTH)) return true;
  const vowels = [...letters].filter((ch) => VOWELS.has(ch)).length;
  if (vowels / letters.length < MIN_VOWEL_SHARE) return true;
  return repeatsUnit(letters);
}
