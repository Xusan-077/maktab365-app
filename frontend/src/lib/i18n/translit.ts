/**
 * O'zbek lotin → kirill transliteratsiyasi (uz-Cyrl uchun).
 * Qoidalar: o'→ў, g'→ғ, sh→ш, ch→ч, ng→нг, ye→е, yo→ё, yu→ю, ya→я,
 * so'z boshidagi e→э, harflar orasidagi tutuq belgisi → ъ, s'h / c'h → с+ҳ / ц+ҳ ajratish.
 */

const APOSTROPHES = new Set(["'", "ʻ", "ʼ", "‘", "’", "`", "´"]);

const SINGLE: Record<string, string> = {
  a: "а",
  b: "б",
  c: "ц",
  d: "д",
  e: "е",
  f: "ф",
  g: "г",
  h: "ҳ",
  i: "и",
  j: "ж",
  k: "к",
  l: "л",
  m: "м",
  n: "н",
  o: "о",
  p: "п",
  q: "қ",
  r: "р",
  s: "с",
  t: "т",
  u: "у",
  v: "в",
  w: "в",
  x: "х",
  y: "й",
  z: "з",
};

const isLatinLetter = (ch: string | undefined) => !!ch && /^[a-z]$/i.test(ch);
const isUpper = (ch: string) => ch !== ch.toLowerCase();
const isApostrophe = (ch: string | undefined) => !!ch && APOSTROPHES.has(ch);

/** Kirill harfning registrini manba (lotin) harfning registriga moslaydi. */
function withCase(cyrillic: string, source: string): string {
  return isUpper(source) ? cyrillic.toUpperCase() : cyrillic;
}

/**
 * Matematik ifodalar o'girilmaydi: "x² + px + q = 0", "x₁ + x₂ = −p", "p = −7", yakka "x₁" yoki "−p".
 * Ifoda — 1–3 harfli o'zgaruvchi/son operandlari, ular orasida + − · * / = ≠ ≤ ≥ < > belgilaridan biri.
 * Eslatma: gap ichidagi yakka o'zgaruvchi ("q ga teng") aniqlanmaydi, bunday gaplardan qoching.
 */
const SCRIPTS = "²³₀-₉";
const VARIABLE = `(?:(?:[A-Za-z][${SCRIPTS}]*){1,3})`;
const NUMBER = `\\d+(?:[.,]\\d+)?[${SCRIPTS}]*`;
const OPERAND = `−?(?:${NUMBER}${VARIABLE}?|${VARIABLE})`;
const OPERATOR = "\\s*[+−·×*/=≠≤≥<>^]\\s*";
const MATH_PATTERN = new RegExp(
  `(?<![A-Za-z'’ʻ])(?:${OPERAND}(?:${OPERATOR}${OPERAND})+|[A-Za-z][${SCRIPTS}]+|−[A-Za-z])(?![A-Za-z${SCRIPTS}])`,
  "g",
);

/** Oddiy matnni (ICU sintaksisisiz) lotindan kirillga o'giradi. Lotin bo'lmagan belgilar va matematik ifodalar o'zgarmaydi. */
export function latinToCyrillic(input: string): string {
  let out = "";
  let last = 0;
  for (const match of input.matchAll(MATH_PATTERN)) {
    out += convert(input.slice(last, match.index)) + match[0];
    last = match.index + match[0].length;
  }
  return out + convert(input.slice(last));
}

function convert(input: string): string {
  let out = "";
  let i = 0;

  while (i < input.length) {
    const ch = input[i];
    const lower = ch.toLowerCase();
    const next = input[i + 1];
    const nextLower = next?.toLowerCase();

    if (!isLatinLetter(ch)) {
      // Harflar orasidagi tutuq belgisi: ma'no → маъно
      if (isApostrophe(ch) && isLatinLetter(input[i - 1]) && isLatinLetter(next)) {
        out += "ъ";
      } else {
        out += ch;
      }
      i += 1;
      continue;
    }

    // o' → ў, g' → ғ
    if ((lower === "o" || lower === "g") && isApostrophe(next)) {
      out += withCase(lower === "o" ? "ў" : "ғ", ch);
      i += 2;
      continue;
    }

    // s'h, c'h — digraf emas: Is'hoq → Исҳоқ
    if (
      (lower === "s" || lower === "c") &&
      isApostrophe(next) &&
      input[i + 2]?.toLowerCase() === "h"
    ) {
      out += withCase(SINGLE[lower], ch);
      i += 2;
      continue;
    }

    if (lower === "s" && nextLower === "h") {
      out += withCase("ш", ch);
      i += 2;
      continue;
    }
    if (lower === "c" && nextLower === "h") {
      out += withCase("ч", ch);
      i += 2;
      continue;
    }

    if (lower === "y") {
      // yo'l → йўл: "yo" dan keyin tutuq bo'lsa, ё emas
      if (nextLower === "o" && !isApostrophe(input[i + 2])) {
        out += withCase("ё", ch);
        i += 2;
        continue;
      }
      if (nextLower === "u") {
        out += withCase("ю", ch);
        i += 2;
        continue;
      }
      if (nextLower === "a") {
        out += withCase("я", ch);
        i += 2;
        continue;
      }
      if (nextLower === "e") {
        out += withCase("е", ch);
        i += 2;
        continue;
      }
    }

    // So'z boshida e → э
    if (lower === "e" && !isLatinLetter(input[i - 1]) && !isApostrophe(input[i - 1])) {
      out += withCase("э", ch);
      i += 1;
      continue;
    }

    out += withCase(SINGLE[lower], ch);
    i += 1;
  }

  return out;
}

/** `{` dan boshlab mos keluvchi `}` indeksi (topilmasa -1). */
function findClosingBrace(text: string, start: number): number {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth += 1;
    else if (text[i] === "}" && --depth === 0) return i;
  }
  return -1;
}

const HTML_TAG = /^<\/?[a-z][^>]*>/i;

/**
 * ICU xabarini o'giradi: `{name}`, `{n, plural, one {…} other {…}}` va `<b>…</b>` sintaksisi
 * o'zgarmaydi, faqat oddiy matn va plural/select tarmoqlari ichidagi matn o'giriladi.
 */
export function transliterateMessage(message: string): string {
  let out = "";
  let plain = "";
  const flush = () => {
    out += latinToCyrillic(plain);
    plain = "";
  };

  let i = 0;
  while (i < message.length) {
    const ch = message[i];

    if (ch === "{") {
      const end = findClosingBrace(message, i);
      if (end !== -1) {
        flush();
        out += `{${transliterateArgument(message.slice(i + 1, end))}}`;
        i = end + 1;
        continue;
      }
    }

    if (ch === "<") {
      const tag = HTML_TAG.exec(message.slice(i));
      if (tag) {
        flush();
        out += tag[0];
        i += tag[0].length;
        continue;
      }
    }

    plain += ch;
    i += 1;
  }

  flush();
  return out;
}

/** `{…}` ichi: argument nomi va turi o'zgarmaydi, ichki `{…}` tarmoqlari xabar sifatida o'giriladi. */
function transliterateArgument(body: string): string {
  let out = "";
  let i = 0;
  while (i < body.length) {
    if (body[i] === "{") {
      const end = findClosingBrace(body, i);
      if (end !== -1) {
        out += `{${transliterateMessage(body.slice(i + 1, end))}}`;
        i = end + 1;
        continue;
      }
    }
    out += body[i];
    i += 1;
  }
  return out;
}

export type MessageTree = { [key: string]: string | MessageTree };

/**
 * Xabarlar daraxtini o'giradi. `skip` true qaytargan yo'llar (nuqta bilan, masalan "language.names")
 * va ularning ichidagilar o'zgarishsiz qoladi.
 */
export function transliterateMessages(
  messages: MessageTree,
  skip: (path: string) => boolean = () => false,
  prefix = "",
): MessageTree {
  const result: MessageTree = {};
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (skip(path)) result[key] = value;
    else if (typeof value === "string") result[key] = transliterateMessage(value);
    else result[key] = transliterateMessages(value, skip, path);
  }
  return result;
}
