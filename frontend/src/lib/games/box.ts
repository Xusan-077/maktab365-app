/**
 * Sirli quti: savollar soni bo'yicha raqamli qutilar. Har 16 tadan 1 ta Bonus (+2) va 1 ta Bomba
 * (−1) — savolsiz, joylashuvi tasodifiy; qolgan qutilar ketma-ket savollarga bog'langan.
 */

export type BoxKind = "question" | "bonus" | "bomb";
export type BoxResult = "correct" | "wrong" | "bonus" | "bomb";

export interface BoxCell {
  kind: BoxKind;
  /** `questions` dagi indeks (faqat savolli qutida). */
  question: number | null;
  /** Ochilgan qutining natijasi; yopiq — `null`. */
  result: BoxResult | null;
}

export const BONUS_POINTS = 2;
export const BOMB_POINTS = -1;
const BOXES_PER_SPECIAL = 16;

/** Bonus va bomba qutilari soni (har biri): 8–16 qutida 1 tadan, 24 da 2 tadan. */
export const specialCount = (boxCount: number) =>
  boxCount < 4 ? 0 : Math.max(1, Math.round(boxCount / BOXES_PER_SPECIAL));

/** Qutilar to'ri: `random` — testlarda aniq natija uchun almashtiriladi. */
export function makeBoxes(boxCount: number, random: () => number = Math.random): BoxCell[] {
  const specials = specialCount(boxCount);
  const kinds: BoxKind[] = Array.from({ length: boxCount }, (_, index) =>
    index < specials ? "bonus" : index < specials * 2 ? "bomb" : "question",
  );
  // Fisher–Yates
  for (let index = kinds.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [kinds[index], kinds[swap]] = [kinds[swap], kinds[index]];
  }
  let question = 0;
  return kinds.map((kind) => ({
    kind,
    question: kind === "question" ? question++ : null,
    result: null,
  }));
}

/** Savolli qutilar soni = shuncha savol kerak. */
export const boxQuestionCount = (boxCount: number) => boxCount - specialCount(boxCount) * 2;

export const allOpened = (boxes: BoxCell[]) =>
  boxes.length > 0 && boxes.every((box) => box.result !== null);

/** Qutini ochish (o'zgarmas). Allaqachon ochilgan quti o'zgarmaydi. */
export function openBox(boxes: BoxCell[], cell: number, result: BoxResult): BoxCell[] {
  return boxes.map((box, index) =>
    index === cell && box.result === null ? { ...box, result } : box,
  );
}

/** Maxsus quti ochilganda beriladigan ball. */
export const specialPoints = (kind: BoxKind) =>
  kind === "bonus" ? BONUS_POINTS : kind === "bomb" ? BOMB_POINTS : 0;
