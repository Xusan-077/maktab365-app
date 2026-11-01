/**
 * Matematika kitob: yechim matnidagi formulalar (LaTeX) bilan ishlovchi sof mantiq (DOM'siz).
 * Matn ichida formula `$...$` (qator ichida) yoki `$$...$$` (alohida qatorda) orasida yoziladi;
 * `\$` — oddiy dollar belgisi. Chizish uchun KaTeX ishlatiladi (`MathText`).
 */

export type MathSegment =
  | { kind: "text"; value: string }
  | { kind: "inline"; value: string }
  | { kind: "block"; value: string };

/** Matnni oddiy matn va formula bo'laklariga ajratadi; yopilmagan `$` oddiy matn bo'lib qoladi. */
export function splitMath(input: string): MathSegment[] {
  const segments: MathSegment[] = [];
  let text = "";
  const flush = () => {
    if (text) segments.push({ kind: "text", value: text });
    text = "";
  };

  let index = 0;
  while (index < input.length) {
    const char = input[index];
    if (char === "\\" && input[index + 1] === "$") {
      text += "$";
      index += 2;
      continue;
    }
    if (char !== "$") {
      text += char;
      index += 1;
      continue;
    }
    const block = input[index + 1] === "$";
    const open = block ? 2 : 1;
    const end = findClosing(input, index + open, block);
    const body = end === -1 ? "" : input.slice(index + open, end);
    if (end === -1 || body.trim() === "") {
      // Yopilmagan yoki bo'sh formula: `$` belgisining o'zi matn.
      text += input.slice(index, index + open);
      index += open;
      continue;
    }
    flush();
    segments.push({ kind: block ? "block" : "inline", value: body.trim() });
    index = end + open;
  }
  flush();
  return segments;
}

function findClosing(input: string, from: number, block: boolean): number {
  for (let index = from; index < input.length; index += 1) {
    if (input[index] === "\\") {
      index += 1;
      continue;
    }
    if (input[index] !== "$") continue;
    if (!block) return index;
    if (input[index + 1] === "$") return index;
  }
  return -1;
}

/** Matnda kamida bitta formula bormi (oddiy matn uchun KaTeX yuklanmaydi). */
export function hasMath(input: string): boolean {
  return splitMath(input).some((segment) => segment.kind !== "text");
}

// --- Tez belgilar paneli ---

export interface MathSnippet {
  id: string;
  /** Tugmadagi qisqa belgi (oddiy matn; formulaning o'zi emas). */
  glyph: string;
  /** Qo'yiladigan LaTeX. `{}` — to'ldiriladigan joy: kursor birinchisiga qo'yiladi. */
  latex: string;
}

export const SNIPPET_GROUPS = ["structure", "greek"] as const;
export type SnippetGroup = (typeof SNIPPET_GROUPS)[number];

export const MATH_SNIPPETS: Record<SnippetGroup, readonly MathSnippet[]> = {
  structure: [
    { id: "fraction", glyph: "a/b", latex: "\\frac{}{}" },
    { id: "root", glyph: "√", latex: "\\sqrt{}" },
    { id: "power", glyph: "xⁿ", latex: "^{}" },
    { id: "subscript", glyph: "xₙ", latex: "_{}" },
    { id: "integral", glyph: "∫", latex: "\\int_{}^{}" },
    { id: "sum", glyph: "Σ", latex: "\\sum_{}^{}" },
    { id: "pm", glyph: "±", latex: "\\pm " },
    { id: "leq", glyph: "≤", latex: "\\leq " },
    { id: "geq", glyph: "≥", latex: "\\geq " },
    { id: "neq", glyph: "≠", latex: "\\neq " },
  ],
  greek: [
    { id: "alpha", glyph: "α", latex: "\\alpha " },
    { id: "beta", glyph: "β", latex: "\\beta " },
    { id: "gamma", glyph: "γ", latex: "\\gamma " },
    { id: "delta", glyph: "δ", latex: "\\delta " },
    { id: "theta", glyph: "θ", latex: "\\theta " },
    { id: "lambda", glyph: "λ", latex: "\\lambda " },
    { id: "pi", glyph: "π", latex: "\\pi " },
    { id: "sigma", glyph: "σ", latex: "\\sigma " },
    { id: "phi", glyph: "φ", latex: "\\varphi " },
    { id: "omega", glyph: "ω", latex: "\\omega " },
  ],
};

/** Kursor `$...$` ichidami: ochilgan (`\$` bo'lmagan) dollarlar soni toq bo'lsa — ichida. */
export function isInsideMath(value: string, caret: number): boolean {
  let count = 0;
  for (let index = 0; index < caret; index += 1) {
    if (value[index] === "\\") {
      index += 1;
      continue;
    }
    if (value[index] === "$") count += 1;
  }
  return count % 2 === 1;
}

export interface InsertResult {
  value: string;
  caret: number;
}

/**
 * Belgini kursor o'rniga qo'yadi. Formula tashqarisida `$...$` bilan o'raladi. Belgilangan matn
 * birinchi `{}` ichiga tushadi (masalan `x+1` belgilanib kasr tanlansa — `\frac{x+1}{}`).
 */
export function insertSnippet(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  snippet: MathSnippet,
): InsertResult {
  const start = Math.max(0, Math.min(selectionStart, value.length));
  const end = Math.max(start, Math.min(selectionEnd, value.length));
  const selected = value.slice(start, end);
  const slot = snippet.latex.indexOf("{}");

  let inner = snippet.latex;
  let caretInInner = inner.length;
  if (slot !== -1) {
    inner = `${snippet.latex.slice(0, slot + 1)}${selected}${snippet.latex.slice(slot + 1)}`;
    caretInInner = slot + 1 + selected.length;
    // Belgilangan matn bo'lsa kursor keyingi bo'sh joyga o'tadi.
    if (selected) {
      const next = inner.indexOf("{}", caretInInner);
      if (next !== -1) caretInInner = next + 1;
      else caretInInner = inner.length;
    }
  } else if (selected) {
    inner = `${snippet.latex}${selected}`;
    caretInInner = inner.length;
  }

  const wrap = !isInsideMath(value, start);
  const prefix = wrap ? "$" : "";
  const suffix = wrap ? "$" : "";
  const next = `${value.slice(0, start)}${prefix}${inner}${suffix}${value.slice(end)}`;
  return { value: next, caret: start + prefix.length + caretInInner };
}
