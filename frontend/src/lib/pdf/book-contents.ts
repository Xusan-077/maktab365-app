/**
 * Kitob sahifasidagi mundarija (sof funksiyalar): API daraxtidan boblar, paragraflar, bob oxiridagi
 * mashq/testlar, kirish va ilova qatorlari; oxirgi o'qilgan betga nisbatan holatlar va foizlar;
 * qidiruv + filtr va `<mark>` uchun mos bo'laklar.
 */

import { cyrillicToLatin, normalizeSearchText } from "@/lib/i18n/translit";
import { sectionLabel, type TocChapter, type TocLeaf } from "./toc";

export type PracticeKind = "exercise" | "test" | "project";

export interface ContentsRow {
  id: string;
  title: string;
  page: number;
}

export interface ContentsParagraph extends ContentsRow {
  /** "15-§" (sarlavhada bo'lsa), aks holda `null`. */
  label: string | null;
  /** Prefiksiz nom: "15-§. Kvadrat tenglama" → "Kvadrat tenglama". */
  name: string;
  /** Paragrafning oxirgi beti (keyingi paragrafdan oldingi bet yoki bob oxiri). */
  endPage: number;
}

export interface ContentsPractice extends ContentsRow {
  kind: PracticeKind;
}

export interface ContentsChapter {
  id: string;
  title: string;
  /** Bob nomi prefiksiz ("II bob." olib tashlangan, KATTA HARFLI nom oddiy yozuvga). */
  name: string;
  roman: string;
  startPage: number;
  endPage: number;
  paragraphs: ContentsParagraph[];
  practice: ContentsPractice[];
}

export interface BookContents {
  /** Birinchi bobdan oldingi bobsiz qatorlar (takrorlash, kirish). */
  intro: ContentsRow[];
  chapters: ContentsChapter[];
  /** Boblardan keyingi bobsiz qatorlar (ilovalar, javoblar). */
  appendix: ContentsRow[];
  totalPages: number;
}

const ROMAN: [number, string][] = [
  [1000, "M"],
  [900, "CM"],
  [500, "D"],
  [400, "CD"],
  [100, "C"],
  [90, "XC"],
  [50, "L"],
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

export function toRoman(value: number): string {
  let rest = Math.max(1, Math.floor(value));
  let out = "";
  for (const [step, symbol] of ROMAN) {
    while (rest >= step) {
      out += symbol;
      rest -= step;
    }
  }
  return out;
}

/** "II bob. Nom", "2-bob: Nom", "II BOB – NOM" → raqam va nom; bob emas — `null`. */
const CHAPTER_PREFIX = /^\s*(?:([IVXLC]+)|(\d{1,2}))\s*-?\s*bob\b\s*[.:–—-]?\s*/i;
const CHAPTER_WORD = /\bbob\b/i;
const PARAGRAPH_PREFIX = /^\s*(?:\d{1,3}\s*-?\s*§|§\s*\d{1,3})\s*[.:–—-]?\s*/;
const APPENDIX = /ilova/i;

/** Mashq/test/amaliy qator (lotin va kirill sarlavhalar uchun). */
export function practiceKind(title: string): PracticeKind | null {
  const text = normalizeSearchText(title);
  if (/\btest|sinov|nazorat/.test(text)) return "test";
  if (/amaliy|loyiha/.test(text)) return "project";
  if (/mashq|masala/.test(text)) return "exercise";
  return null;
}

/** Faqat katta harfli sarlavha ("ALGEBRAIK IFODALAR") → "Algebraik ifodalar"; boshqasi o'zgarmaydi. */
export function toSentenceCase(text: string): string {
  if (text !== text.toUpperCase() || text === text.toLowerCase()) return text;
  const lower = text.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function chapterName(title: string): { name: string; roman: string | null } {
  const match = CHAPTER_PREFIX.exec(title);
  if (!match) return { name: toSentenceCase(title.trim()), roman: null };
  const roman = match[1] ? match[1].toUpperCase() : toRoman(Number(match[2]));
  const name = title.slice(match[0].length).trim();
  return { name: toSentenceCase(name || title.trim()), roman };
}

const isChapter = (node: TocChapter) =>
  (node.children?.length ?? 0) > 0 || CHAPTER_WORD.test(normalizeSearchText(node.title));

const row = (leaf: TocLeaf): ContentsRow => ({ id: leaf.id, title: leaf.title, page: leaf.page });

/**
 * API daraxti → mundarija. Bob — bolalari bor yoki nomida "bob" bo'lgan yuqori daraja; undan
 * oldingi bobsiz qatorlar — kirish, keyingilari — ilova. Bob oralig'i: birinchi beti (bob yoki
 * birinchi qatori) dan keyingi bob boshigacha (oxirgi bob — `totalPages` gacha).
 */
export function buildBookContents(
  chapters: readonly TocChapter[],
  totalPages: number,
): BookContents {
  const intro: ContentsRow[] = [];
  const appendix: ContentsRow[] = [];
  const raw: { node: TocChapter; start: number }[] = [];

  for (const node of chapters) {
    if (isChapter(node) && !APPENDIX.test(node.title)) {
      const pages = [node.page, ...(node.children ?? []).map((child) => child.page)];
      raw.push({ node, start: Math.min(...pages) });
    } else if (raw.length === 0) {
      intro.push(row(node));
    } else {
      appendix.push(row(node), ...(node.children ?? []).map(row));
    }
  }

  const appendixStart = appendix.length > 0 ? Math.min(...appendix.map((item) => item.page)) : 0;
  const result: ContentsChapter[] = raw.map(({ node, start }, index) => {
    const next = raw[index + 1]?.start ?? (appendixStart > start ? appendixStart : totalPages + 1);
    const endPage = Math.max(start, Math.min(totalPages, next - 1));
    const { name, roman } = chapterName(node.title);

    const paragraphs: ContentsParagraph[] = [];
    const practice: ContentsPractice[] = [];
    for (const child of node.children ?? []) {
      // "12-§. … masalalar" — paragraf: § belgisi bo'lsa mashq deb hisoblanmaydi.
      const kind = sectionLabel(child.title) ? null : practiceKind(child.title);
      if (kind) practice.push({ ...row(child), kind });
      else if (APPENDIX.test(child.title)) appendix.push(row(child));
      else {
        const label = sectionLabel(child.title);
        const name = label ? child.title.replace(PARAGRAPH_PREFIX, "").trim() : child.title.trim();
        paragraphs.push({ ...row(child), label, name: name || child.title, endPage });
      }
    }
    paragraphs.sort((a, b) => a.page - b.page);
    paragraphs.forEach((paragraph, i) => {
      const following = paragraphs[i + 1];
      paragraph.endPage = following
        ? Math.max(paragraph.page, following.page - 1)
        : Math.max(paragraph.page, endPage);
    });

    return {
      id: node.id,
      title: node.title,
      name,
      roman: roman ?? toRoman(index + 1),
      startPage: start,
      endPage,
      paragraphs,
      practice,
    };
  });

  return { intro, chapters: result, appendix, totalPages };
}

export type ParagraphStatus = "done" | "current" | "pending";
export type ChapterState = "done" | "inProgress" | "unread";

export interface ContentsProgress {
  /** `null` — hech narsa o'qilmagan. */
  lastPage: number | null;
  paragraphs: Map<string, ParagraphStatus>;
  chapters: Map<string, { state: ChapterState; percent: number }>;
  currentParagraphId: string | null;
  /** Oxirgi o'qilgan bet joylashgan bob (yoki undan keyingi birinchi o'qilmagan bob). */
  currentChapterId: string | null;
  /** Tugatilgan paragraflar soni (kirish, mashq, ilova hisobga kirmaydi). */
  doneCount: number;
  /** 0..100: lastPage / totalPages. */
  percent: number;
  finished: boolean;
}

/**
 * Oxirgi o'qilgan bet bo'yicha holatlar. Joriy paragraf — bet oralig'ida turgani; undan oldingilari
 * tugatilgan, keyingilari kutayotgan. Kitob oxiriga yetilgan bo'lsa hammasi tugatilgan. Bob foizi —
 * bobdagi o'qilgan betlar / bob betlari.
 */
export function contentsProgress(
  contents: BookContents,
  lastPage: number | null,
): ContentsProgress {
  const total = Math.max(1, contents.totalPages);
  const page = lastPage !== null && lastPage >= 1 ? Math.min(lastPage, total) : null;
  const finished = page !== null && page >= total;
  const paragraphs = new Map<string, ParagraphStatus>();
  const chapters = new Map<string, { state: ChapterState; percent: number }>();
  let currentParagraphId: string | null = null;
  let currentChapterId: string | null = null;
  let doneCount = 0;

  for (const chapter of contents.chapters) {
    const length = chapter.endPage - chapter.startPage + 1;
    const read = page === null ? 0 : Math.min(length, Math.max(0, page - chapter.startPage + 1));
    const state: ChapterState =
      page === null || read === 0 ? "unread" : read >= length ? "done" : "inProgress";
    chapters.set(chapter.id, { state, percent: Math.round((read / length) * 100) });
    if (currentChapterId === null && page !== null && state === "inProgress") {
      currentChapterId = chapter.id;
    }

    for (const paragraph of chapter.paragraphs) {
      let status: ParagraphStatus = "pending";
      if (page !== null) {
        if (finished || page > paragraph.endPage) status = "done";
        else if (page >= paragraph.page) status = "current";
      }
      if (status === "current") currentParagraphId = paragraph.id;
      if (status === "done") doneCount += 1;
      paragraphs.set(paragraph.id, status);
    }
  }

  return {
    lastPage: page,
    paragraphs,
    chapters,
    currentParagraphId,
    currentChapterId,
    doneCount,
    percent: page === null ? 0 : Math.round((page / total) * 100),
    finished,
  };
}

/** Standart ochiq bob: davom etayotgani; hech narsa o'qilmagan bo'lsa (yoki topilmasa) birinchisi. */
export function defaultOpenChapter(
  contents: BookContents,
  progress: ContentsProgress,
): string | null {
  if (progress.currentChapterId) return progress.currentChapterId;
  if (progress.lastPage !== null && !progress.finished) {
    const next = contents.chapters.find((c) => progress.chapters.get(c.id)?.state === "unread");
    if (next) return next.id;
  }
  return contents.chapters[0]?.id ?? null;
}

export const CONTENTS_FILTERS = ["all", "inProgress", "unread", "tests"] as const;
export type ContentsFilter = (typeof CONTENTS_FILTERS)[number];

export interface VisibleChapter {
  chapter: ContentsChapter;
  paragraphs: ContentsParagraph[];
  practice: ContentsPractice[];
}

export interface VisibleContents {
  intro: ContentsRow[];
  chapters: VisibleChapter[];
  appendix: ContentsRow[];
  /** Ko'rinadigan qatorlar soni (paragraf, mashq, kirish, ilova). */
  count: number;
}

const matcher = (query: string) => {
  const needle = normalizeSearchText(query.trim());
  return needle ? (text: string) => normalizeSearchText(text).includes(needle) : null;
};

/**
 * Qidiruv va filtr birga. Bob nomi mos kelsa — bobning (filtrdan o'tgan) hamma qatorlari, aks holda
 * faqat mos qatorlar. Filtrlar: davom etayotgan — davom etayotgan bob; o'qilmagan — tugatilmagan
 * paragraflar; testlar — bob oxiridagi qatorlar. Kirish/ilova faqat "Hammasi" filtrida.
 */
export function filterContents(
  contents: BookContents,
  progress: ContentsProgress,
  query: string,
  filter: ContentsFilter,
): VisibleContents {
  const matches = matcher(query);
  const chapters: VisibleChapter[] = [];

  for (const chapter of contents.chapters) {
    const state = progress.chapters.get(chapter.id)?.state ?? "unread";
    let paragraphs = chapter.paragraphs;
    let practice = chapter.practice;
    if (filter === "inProgress" && state !== "inProgress") continue;
    if (filter === "unread") {
      paragraphs = paragraphs.filter((p) => progress.paragraphs.get(p.id) !== "done");
      practice = [];
    }
    if (filter === "tests") paragraphs = [];

    if (matches && !matches(chapter.title)) {
      paragraphs = paragraphs.filter((p) => matches(p.title));
      practice = practice.filter((p) => matches(p.title));
    }
    if (paragraphs.length + practice.length === 0) {
      // Bo'sh bob faqat "Hammasi"da, qidiruvsiz (yoki nomi mos kelganda) ko'rinadi.
      const keep = filter === "all" && (!matches || matches(chapter.title));
      if (!keep) continue;
    }
    chapters.push({ chapter, paragraphs, practice });
  }

  const rows = (list: ContentsRow[]) =>
    filter !== "all" ? [] : matches ? list.filter((item) => matches(item.title)) : list;
  const intro = rows(contents.intro);
  const appendix = rows(contents.appendix);
  const count =
    intro.length +
    appendix.length +
    chapters.reduce((sum, c) => sum + c.paragraphs.length + c.practice.length, 0);
  return { intro, chapters, appendix, count };
}

export interface HighlightPart {
  text: string;
  match: boolean;
}

/**
 * `text` ni qidiruv so'roviga mos va mos bo'lmagan bo'laklarga ajratadi (`normalizeSearchText`
 * qoidalari bilan: katta-kichik harf, tutuq belgisi, kirill). Mos kelmasa — bitta bo'lak.
 */
export function highlightParts(text: string, query: string): HighlightPart[] {
  const needle = normalizeSearchText(query.trim());
  if (!needle) return [{ text, match: false }];
  // Har bir normallashgan belgi qaysi asl belgidan kelgani.
  let normalized = "";
  const origin: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const piece = cyrillicToLatin(text[i].toLowerCase()).replace(/['ʻʼ‘’`´]/g, "");
    for (const char of piece) {
      normalized += char;
      origin.push(i);
    }
  }
  const parts: HighlightPart[] = [];
  let cursor = 0;
  let from = 0;
  for (;;) {
    const at = normalized.indexOf(needle, from);
    if (at === -1) break;
    const start = origin[at];
    const end = origin[at + needle.length - 1] + 1;
    if (start > cursor) parts.push({ text: text.slice(cursor, start), match: false });
    parts.push({ text: text.slice(start, end), match: true });
    cursor = end;
    from = at + needle.length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false });
  return parts.length > 0 ? parts : [{ text, match: false }];
}
