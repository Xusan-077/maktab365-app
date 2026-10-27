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
