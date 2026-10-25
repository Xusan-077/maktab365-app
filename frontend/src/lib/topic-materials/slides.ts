/** Taqdimot slaydlari (sof funksiyalar): o'quvchiga ko'rinadiganlar, tartib va yuklash cheklovlari. */

import type { Slide, SlidePatch } from "./types";

/** Yuklanadigan fayl chegarasi. */
export const PRESENTATION_MAX_BYTES = 25 * 1024 * 1024;
export const PRESENTATION_EXTENSIONS = [".pptx", ".pdf"] as const;
export const PRESENTATION_ACCEPT =
  ".pptx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation";

export type PresentationFileProblem = "type" | "size" | "empty";

export function presentationFileProblem(file: {
  name: string;
  size: number;
}): PresentationFileProblem | null {
  const name = file.name.toLowerCase();
  if (!PRESENTATION_EXTENSIONS.some((extension) => name.endsWith(extension))) return "type";
  if (file.size === 0) return "empty";
  if (file.size > PRESENTATION_MAX_BYTES) return "size";
  return null;
}

/** Tartib bo'yicha; yashirinlari chiqarilgan (o'quvchi ko'rinishi). */
export function visibleSlides(slides: readonly Slide[]): Slide[] {
  return [...slides].filter((slide) => !slide.hidden).sort((a, b) => a.order - b.order);
}

export const sortSlides = (slides: readonly Slide[]): Slide[] =>
  [...slides].sort((a, b) => a.order - b.order);

/** `?slayd=N` (1 dan) → 0 dan indeks, chegaraga keltirilgan. */
export function slideIndexParam(raw: string | null, count: number): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || count === 0) return 0;
  return Math.min(count - 1, Math.max(0, value - 1));
}

/** Muharrirdagi ro'yxat → PATCH tanasi: tartib qayta raqamlanadi (1..N), `note` bo'sh satr. */
export function toSlidePatches(slides: readonly Slide[]): SlidePatch[] {
  return slides.map((slide, index) => ({
    id: slide.id,
    order: index + 1,
    hidden: slide.hidden,
    note: slide.note ?? "",
    alt: slide.alt,
  }));
}
