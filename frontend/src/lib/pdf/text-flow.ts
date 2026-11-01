/** PDF.js matn bo'laklaridan o'qiladigan matn: qatorlar va xatboshilar (matnli o'qish rejimi). */

export interface FlowItem {
  str: string;
  /** PDF matritsasi `[a, b, c, d, e, f]`: `f` — qator balandligi (y). */
  transform?: readonly number[];
  height?: number;
  hasEOL?: boolean;
}

/** Qatorlar orasidagi masofa shu koeffitsientdan (shrift balandligiga nisbatan) oshsa — yangi xatboshi. */
const PARAGRAPH_GAP = 1.7;
/** Shu koeffitsientdan ko'p siljish — yangi qator (y farqi shrift balandligiga nisbatan). */
const NEW_LINE_SHIFT = 0.5;

interface Line {
  text: string;
  y: number | null;
  height: number;
}

const isItem = (item: FlowItem | object): item is FlowItem => "str" in item;

/**
 * Bo'laklarni qatorlarga (y bo'yicha) va xatboshilarga (katta oraliq) ajratadi; xatboshilar
 * bo'sh qator bilan ajratiladi (`toParagraphs` shuni kutadi).
 */
export function textFlow(items: readonly (FlowItem | object)[]): string {
  const lines: Line[] = [];
  let current: Line | null = null;
  const flush = () => {
    if (current && current.text.trim()) lines.push(current);
    current = null;
  };

  for (const item of items) {
    if (!isItem(item)) continue;
    const y = item.transform?.[5] ?? null;
    const height = item.height || Math.abs(item.transform?.[3] ?? 0) || 10;
    if (
      current &&
      y !== null &&
      current.y !== null &&
      Math.abs(y - current.y) > Math.max(current.height, height) * NEW_LINE_SHIFT
    ) {
      flush();
    }
    current ??= { text: "", y, height };
    current.text += item.str;
    if (current.y === null) current.y = y;
    current.height = Math.max(current.height, height);
    if (item.hasEOL) flush();
  }
  flush();

  const out: string[] = [];
  lines.forEach((line, index) => {
    const previous = lines[index - 1];
    if (previous) {
      const gap = previous.y !== null && line.y !== null ? Math.abs(previous.y - line.y) : 0;
      out.push(gap > Math.max(previous.height, line.height) * PARAGRAPH_GAP ? "\n\n" : "\n");
    }
    out.push(line.text.trim());
  });
  return out.join("");
}
