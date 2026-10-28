/**
 * Omad charhi geometriyasi. Ko'rsatkich tepada (0°); 0-sektor tepadan soat yo'nalishi bo'yicha
 * `[0, 360/n)` oralig'ida. Charx soat yo'nalishida `rotation` gradusga burilganda ko'rsatkich
 * charxning `-rotation` burchagidagi sektorga tushadi.
 */

const normalize = (deg: number) => ((deg % 360) + 360) % 360;

export const sectorAngle = (sectorCount: number) => 360 / sectorCount;

/** Burilish burchagi bo'yicha ko'rsatkich ostidagi sektor indeksi. */
export function sectorAt(rotation: number, sectorCount: number): number {
  if (sectorCount < 1) throw new RangeError("sectorCount must be ≥ 1");
  const pointer = normalize(-rotation);
  return Math.min(Math.floor(pointer / sectorAngle(sectorCount)), sectorCount - 1);
}

/**
 * `target` sektor markazi ko'rsatkich ostida to'xtashi uchun yakuniy burchak: joriydan oldinga,
 * kamida `turns` to'liq aylanish. `jitter` (−0.5…0.5) — markazdan siljish (sektor ichida qoladi).
 */
export function spinRotation(
  current: number,
  target: number,
  sectorCount: number,
  turns = 5,
  jitter = 0,
): number {
  const size = sectorAngle(sectorCount);
  const offset = Math.max(-0.4, Math.min(0.4, jitter)) * size;
  // Charx shu burchakda bo'lsa target markazi tepada: rotation ≡ −(target + 0.5)·size.
  const goal = normalize(-(target + 0.5) * size - offset);
  const delta = normalize(goal - normalize(current));
  return current + turns * 360 + delta;
}

/** Charx sektori: 1–6 — oddiy savol, "×2" — savol ikki baravar ball, "Bonus" — savolsiz darhol +2. */
export type WheelSector =
  { kind: "question"; label: number } | { kind: "double" } | { kind: "bonus" };

/** Sektorlar tepadan soat yo'nalishi bo'yicha (0-sektor ko'rsatkich ostida, burilmagan charxda). */
export const WHEEL_SECTORS: readonly WheelSector[] = [
  { kind: "question", label: 1 },
  { kind: "question", label: 2 },
  { kind: "double" },
  { kind: "question", label: 3 },
  { kind: "question", label: 4 },
  { kind: "bonus" },
  { kind: "question", label: 5 },
  { kind: "question", label: 6 },
];

export const WHEEL_BONUS_POINTS = 2;
export const WHEEL_SPIN_SECONDS = 4;
/** Aylanish egri chizig'i: tez boshlanib, sekin to'xtaydi. */
export const WHEEL_SPIN_EASE = [0.17, 0.67, 0.12, 1] as const;

/** Sektor uchun ball: oddiy savol 1, "×2" — 2, Bonus — darhol 2 (savolsiz). */
export function sectorPoints(sector: WheelSector): number {
  if (sector.kind === "question") return 1;
  return 2;
}
