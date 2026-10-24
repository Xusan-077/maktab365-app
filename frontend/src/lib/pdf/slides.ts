/**
 * Bo'lim prezentatsiyasi (PDF slaydlar): URL parametrlari (`?slides=<chapter_id>&slide=N`) va oxirgi
 * ko'rilgan slayd (brauzerda, `localStorage`). Sof funksiyalar; storage xatolari ichida yutiladi.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SlidesParams {
  /** Ochiq prezentatsiya bo'limi; yo'q yoki yaroqsiz bo'lsa `null`. */
  chapterId: string | null;
  /** `?slide=` (1 dan); aytilmagan yoki yaroqsiz bo'lsa `null`. */
  slide: number | null;
}

type Raw = { get(name: string): string | null };

export function parseSlidesParams(params: Raw): SlidesParams {
  const id = params.get("slides")?.trim() ?? "";
  const slide = params.get("slide")?.trim() ?? "";
  return {
    chapterId: UUID.test(id) ? id.toLowerCase() : null,
    slide: /^\d+$/.test(slide) && Number(slide) >= 1 ? Number(slide) : null,
  };
}

export interface ParamsPatch {
  page?: number | null;
  slides?: string | null;
  slide?: number | null;
  /** Kitob ichida qidirilgan so'z (sahifada belgilanadi). */
  find?: string | null;
  /** O'qish rejimi: `h` (varaqlash) | `v` (scroll). */
  mode?: "h" | "v" | null;
}

/** Joriy query'ni saqlab (boshqa parametrlar tegilmaydi) `page`/`slides`/`slide` ni almashtiradi. */
export function withSlidesParams(current: URLSearchParams | string, patch: ParamsPatch): string {
  const params = new URLSearchParams(typeof current === "string" ? current : current.toString());
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined) params.delete(key);
    else params.set(key, String(value));
  }
  return params.toString();
}

const STORAGE_PREFIX = "maktab365-slides:";

/** Bo'limning oxirgi ko'rilgan slaydi (1 dan) yoki `null`. */
export function readSlidesProgress(chapterId: string): number | null {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${chapterId}`);
    return raw && /^\d+$/.test(raw) && Number(raw) >= 1 ? Number(raw) : null;
  } catch {
    return null;
  }
}

export function saveSlidesProgress(chapterId: string, slide: number): void {
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${chapterId}`, String(slide));
  } catch {
    // localStorage yopiq (private rejim va h.k.): eslab qolish ixtiyoriy.
  }
}
