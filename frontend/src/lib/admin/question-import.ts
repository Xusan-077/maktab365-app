import { QUESTION_LIMITS } from "@/lib/validation/questions";
import type { LocalizedText } from "@/types/i18n";
import { cleanText } from "./questions";
import type { QuestionDifficulty, QuestionImportItem } from "./types";

/** Bir importda ko'pi bilan (backend `IMPORT_MAX`). */
export const IMPORT_MAX = 200;

export type ImportRowError =
  | "questionRequired"
  | "optionsCount"
  | "optionRequired"
  | "answerInvalid"
  | "difficultyInvalid"
  | "tooLong"
  | "invalidRow";

export interface ImportRow {
  /** Manba qatori (CSV) yoki element raqami (JSON), 1 dan. */
  line: number;
  /** Ko'rsatish uchun savol matni (uz). */
  preview: string;
  item: QuestionImportItem | null;
  errors: ImportRowError[];
}

export interface ImportParseResult {
  format: "json" | "csv";
  rows: ImportRow[];
  /** Butun fayl xatosi: `invalidJson`, `empty`, `tooMany`. */
  error: "invalidJson" | "empty" | "tooMany" | null;
}

const LETTERS = ["a", "b", "c", "d"];
const DIFFICULTY_ALIASES: Record<string, QuestionDifficulty> = {
  easy: "easy",
  oson: "easy",
  medium: "medium",
  "o'rta": "medium",
  orta: "medium",
  hard: "hard",
  qiyin: "hard",
  // uz-Cyrl va ru
  осон: "easy",
  ўрта: "medium",
  қийин: "hard",
  лёгкий: "easy",
  средний: "medium",
  сложный: "hard",
};

/** `A`/`b`/`2`/`B)` → 0..3; noto'g'ri bo'lsa `null`. */
export function answerIndex(raw: unknown): number | null {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[).]$/, "");
  const letter = LETTERS.indexOf(value);
  if (letter >= 0) return letter;
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 4 ? number - 1 : null;
}

function difficultyOf(raw: unknown): QuestionDifficulty | null {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[‘’ʻʼ`]/g, "'");
  if (!value) return "medium";
  return DIFFICULTY_ALIASES[value] ?? null;
}

/** Satr yoki `{uz, ru?, en?}` → LocalizedText (`uz` bo'sh bo'lishi mumkin — keyin tekshiriladi). */
function toText(raw: unknown): LocalizedText {
  if (raw && typeof raw === "object") {
    const value = raw as Record<string, unknown>;
    const pick = (key: string) => (typeof value[key] === "string" ? (value[key] as string) : "");
    return cleanText({ uz: pick("uz"), ru: pick("ru"), en: pick("en") });
  }
  return cleanText({ uz: typeof raw === "string" || typeof raw === "number" ? String(raw) : "" });
}

const tooLong = (text: LocalizedText, max: number) =>
  Object.values(text).some((value) => (value ?? "").length > max);

interface RawQuestion {
  question: unknown;
  options: unknown[];
  answer: unknown;
  difficulty: unknown;
}

/** Bitta savolni tekshiradi va API elementiga aylantiradi. */
export function buildRow(line: number, raw: RawQuestion): ImportRow {
  const errors = new Set<ImportRowError>();
  const text = toText(raw.question);
  const options = raw.options.map(toText);
  const answer = answerIndex(raw.answer);
  const difficulty = difficultyOf(raw.difficulty);

  if (!text.uz) errors.add("questionRequired");
  if (options.length !== QUESTION_LIMITS.options) errors.add("optionsCount");
  else if (options.some((option) => !option.uz)) errors.add("optionRequired");
  if (answer === null) errors.add("answerInvalid");
  if (!difficulty) errors.add("difficultyInvalid");
  if (
    tooLong(text, QUESTION_LIMITS.text) ||
    options.some((option) => tooLong(option, QUESTION_LIMITS.option))
  ) {
    errors.add("tooLong");
  }

  const item: QuestionImportItem | null =
    errors.size === 0
      ? {
          text,
          difficulty: difficulty ?? "medium",
          is_active: true,
          options: options.map((option, index) => ({ text: option, is_correct: index === answer })),
        }
      : null;
  return { line, preview: text.uz, item, errors: [...errors] };
}

// --- JSON ---

const first = (value: Record<string, unknown>, keys: string[]) =>
  keys.map((key) => value[key]).find((item) => item !== undefined && item !== "");

/**
 * JSON massiv. Har element: API shakli `{text, options: [{text, is_correct}], difficulty}` yoki
 * qisqa shakl `{savol|question, A, B, C, D | options: [...], togri_javob|answer, qiyinlik}`.
 */
function parseJson(input: string): ImportParseResult {
  let data: unknown;
  try {
    data = JSON.parse(input);
  } catch {
    return { format: "json", rows: [], error: "invalidJson" };
  }
  const list = Array.isArray(data) ? data : ((data as { questions?: unknown })?.questions ?? null);
  if (!Array.isArray(list)) return { format: "json", rows: [], error: "invalidJson" };
  const rows = list.map((entry, index): ImportRow => {
    if (!entry || typeof entry !== "object") {
      return { line: index + 1, preview: "", item: null, errors: ["invalidRow"] };
    }
    const value = entry as Record<string, unknown>;
    const options = Array.isArray(value.options)
      ? value.options
      : ["A", "B", "C", "D"].map((key) => value[key] ?? value[key.toLowerCase()]);
    const apiOptions = Array.isArray(value.options)
      ? (value.options as Record<string, unknown>[])
      : null;
    // API shakli: variant obyekt `{text, is_correct}` — to'g'ri javob variantning o'zida.
    const isApiShape = apiOptions?.every(
      (option) => option && typeof option === "object" && "text" in option,
    );
    const correct = isApiShape
      ? apiOptions!.flatMap((option, i) => (option.is_correct === true ? [i + 1] : []))
      : [];
    const answer = isApiShape
      ? correct.length === 1
        ? correct[0]
        : ""
      : first(value, ["togri_javob", "to'g'ri_javob", "answer", "correct", "javob"]);
    return buildRow(index + 1, {
      question: first(value, ["text", "savol", "question"]),
      options: isApiShape ? apiOptions!.map((option) => option.text) : options,
      answer,
      difficulty: first(value, ["difficulty", "qiyinlik"]),
    });
  });
  return finish("json", rows);
}

// --- CSV ---

/** RFC 4180: qo'shtirnoqli maydon, `""` — qo'shtirnoq, qator ichida yangi qator. */
export function parseCsv(input: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"' && field === "") {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Birinchi qatorda eng ko'p uchragan ajratuvchi (Excel uz/ru `;` beradi). */
function detectDelimiter(input: string): string {
  const head = input.split(/\r?\n/, 1)[0] ?? "";
  const counts = [",", ";", "\t"].map((d) => [d, head.split(d).length] as const);
  return counts.reduce((best, item) => (item[1] > best[1] ? item : best))[0];
}

/** Ixtiyoriy sarlavha qatorining birinchi ustuni. */
const CSV_HEADER = /^(savol|question|вопрос|савол|text)$/i;

/** CSV: `savol, A, B, C, D, to'g'ri_javob[, qiyinlik]`; sarlavha qatori ixtiyoriy. */
function parseCsvRows(input: string): ImportParseResult {
  const table = parseCsv(input.replace(/^﻿/, ""), detectDelimiter(input));
  const lines = table
    .map((cells, index) => ({ cells, line: index + 1 }))
    .filter(({ cells }) => cells.some((cell) => cell.trim() !== ""));
  if (lines.length > 0 && CSV_HEADER.test(lines[0].cells[0]?.trim() ?? "")) lines.shift();
  const rows = lines.map(({ cells, line }) => {
    // Ustunlar kam bo'lsa ham javob — oxirgi ustun (variantlar soni xatosi aniq chiqsin).
    const full = cells.length >= 6;
    return buildRow(line, {
      question: cells[0],
      options: cells.slice(1, full ? 5 : Math.max(cells.length - 1, 1)),
      answer: full ? cells[5] : cells.at(-1),
      difficulty: full ? cells[6] : "",
    });
  });
  return finish("csv", rows);
}

function finish(format: "json" | "csv", rows: ImportRow[]): ImportParseResult {
  if (rows.length === 0) return { format, rows, error: "empty" };
  if (rows.length > IMPORT_MAX) return { format, rows, error: "tooMany" };
  return { format, rows, error: null };
}

/** Matn (fayl yoki joylashtirilgan) → qatorlar. `[` yoki `{` bilan boshlansa JSON, aks holda CSV. */
export function parseQuestionImport(input: string): ImportParseResult {
  const text = input.trim();
  if (!text) return { format: "csv", rows: [], error: "empty" };
  return /^[[{]/.test(text) ? parseJson(text) : parseCsvRows(text);
}

/** Backend `details.questions` (`{"<indeks>": {...}}`) → yuborilgan qatorlarning `line` lari. */
export function serverRowErrors(details: unknown, sent: readonly ImportRow[]): Set<number> {
  const lines = new Set<number>();
  if (!details || typeof details !== "object") return lines;
  for (const key of Object.keys(details)) {
    const row = sent[Number(key)];
    if (row) lines.add(row.line);
  }
  return lines;
}
