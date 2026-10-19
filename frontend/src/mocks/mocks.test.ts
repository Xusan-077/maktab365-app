import { describe, expect, it } from "vitest";
import {
  bookSchema,
  chapterSchema,
  subjectSchema,
  topicBlockSchema,
  topicSchema,
  userSchema,
} from "@/lib/api/schemas";
import { GRADES } from "@/types/catalog";
import { BOOKS } from "./data/books";
import { CHAPTERS, TOPICS } from "./data/chapters";
import { SUBJECTS } from "./data/subjects";
import { MOCK_USER } from "./data/user";

const VIETA_TOPIC_ID = "algebra-9-viyet-teoremasi";
const PRESENT_PERFECT_TOPIC_ID = "english-9-present-perfect-past-simple";

const validate = (
  schema: { validateSync: (value: unknown, options: object) => unknown },
  v: unknown,
) => schema.validateSync(v, { strict: true, abortEarly: false });

/** 9-sinf tayyor kitoblar: kitob id → mavzular soni (src/content dagi bitta bob). */
const READY_BOOKS = { "algebra-9": 4, "geometry-9": 3, "english-9": 3, "history-9": 3 } as const;
const READY_BOOK_IDS = Object.keys(READY_BOOKS);
const unique = (values: string[]) => new Set(values).size === values.length;

describe("mock ma'lumot sxemalarga mos", () => {
  it.each(SUBJECTS.map((s) => [s.id, s] as const))("fan %s", (_, subject) => {
    expect(() => validate(subjectSchema, subject)).not.toThrow();
  });

  it.each(BOOKS.map((b) => [b.id, b] as const))("kitob %s", (_, book) => {
    expect(() => validate(bookSchema, book)).not.toThrow();
  });

  it.each(CHAPTERS.map((c) => [c.id, c] as const))("bob %s", (_, chapter) => {
    expect(() => validate(chapterSchema, chapter)).not.toThrow();
  });

  it.each(TOPICS.map((t) => [t.id, t] as const))("mavzu %s", (_, topic) => {
    expect(() => validate(topicSchema, topic)).not.toThrow();
  });

  it("foydalanuvchi", () => {
    expect(() => validate(userSchema, MOCK_USER)).not.toThrow();
  });
});

describe("mock ma'lumot yaxlitligi", () => {
  it("id'lar takrorlanmaydi", () => {
    expect(unique(SUBJECTS.map((s) => s.id))).toBe(true);
    expect(unique(BOOKS.map((b) => b.id))).toBe(true);
    expect(unique(CHAPTERS.map((c) => c.id))).toBe(true);
    expect(unique(TOPICS.map((t) => t.id))).toBe(true);
  });

  it("havolalar mavjud obyektlarga ishora qiladi", () => {
    const subjectIds = new Set(SUBJECTS.map((s) => s.id));
    const bookIds = new Set(BOOKS.map((b) => b.id));
    const chapterIds = new Set(CHAPTERS.map((c) => c.id));
    expect(BOOKS.every((b) => subjectIds.has(b.subjectId))).toBe(true);
    expect(CHAPTERS.every((c) => bookIds.has(c.bookId))).toBe(true);
    expect(TOPICS.every((t) => bookIds.has(t.bookId) && chapterIds.has(t.chapterId))).toBe(true);
    for (const chapter of CHAPTERS) {
      expect(
        chapter.topics.every((t) => t.chapterId === chapter.id && t.bookId === chapter.bookId),
      ).toBe(true);
    }
  });

  it("har bir sinfda kamida bitta kitob bor", () => {
    for (const grade of GRADES) expect(BOOKS.some((b) => b.grade === grade)).toBe(true);
  });

  it("9-sinf Algebra, Geometriya, Ingliz tili, Tarix: 1 bob, belgilangan mavzu soni, topicsReady", () => {
    for (const [bookId, topicCount] of Object.entries(READY_BOOKS)) {
      const book = BOOKS.find((b) => b.id === bookId);
      expect(book?.grade).toBe(9);
      expect(book?.topicsReady).toBe(true);
      expect(CHAPTERS.filter((c) => c.bookId === bookId)).toHaveLength(1);
      expect(TOPICS.filter((t) => t.bookId === bookId)).toHaveLength(topicCount);
    }
  });

  it("Tarix kitobi fanlar ro'yxatidagi tarix fani bilan bog'langan", () => {
    const book = BOOKS.find((b) => b.id === "history-9");
    expect(SUBJECTS.find((s) => s.id === book?.subjectId)?.slug).toBe("tarix");
  });

  it("mavzu tartibi va id'lari fayl nomlaridan keladi", () => {
    const algebra = TOPICS.filter((t) => t.bookId === "algebra-9");
    expect(algebra.map((t) => t.id)).toEqual([
      "algebra-9-kvadrat-tenglama",
      "algebra-9-toliqsiz-kvadrat-tenglamalar",
      "algebra-9-diskriminant",
      "algebra-9-viyet-teoremasi",
    ]);
  });

  it("boshqa kitoblarda topicsReady: false va boblar yo'q", () => {
    for (const book of BOOKS.filter((b) => !READY_BOOK_IDS.includes(b.id))) {
      expect(book.topicsReady).toBe(false);
      expect(CHAPTERS.some((c) => c.bookId === book.id)).toBe(false);
    }
  });

  it("barcha mavzu tayyor (bloklari bor) va hali tekshiruvdan o'tmagan (draft)", () => {
    expect(TOPICS).toHaveLength(13);
    for (const topic of TOPICS) {
      expect(topic.ready).toBe(topic.blocks.length > 0);
      expect(topic.ready).toBe(true);
      expect(topic.status).toBe("draft");
    }
  });

  it("bobdagi mavzu xulosalari mavzularning o'zi bilan mos", () => {
    for (const chapter of CHAPTERS) {
      const ids = TOPICS.filter((t) => t.chapterId === chapter.id).map((t) => t.id);
      expect(chapter.topics.map((t) => t.id)).toEqual(ids);
    }
  });

  it("blok id'lari takrorlanmaydi va har mavzuda kamida 3 mashq bor", () => {
    for (const topic of TOPICS) {
      expect(unique(topic.blocks.map((b) => b.id))).toBe(true);
      expect(topic.blocks.filter((b) => b.type === "exercise").length).toBeGreaterThanOrEqual(3);
    }
  });

  it("namuna mavzularda har turdagi mashq bor", () => {
    for (const id of [VIETA_TOPIC_ID, PRESENT_PERFECT_TOPIC_ID]) {
      const topic = TOPICS.find((t) => t.id === id)!;
      const answerTypes = topic.blocks.flatMap((b) =>
        b.type === "exercise" ? [b.answerType] : [],
      );
      expect(new Set(answerTypes)).toEqual(new Set(["choice", "input", "truefalse"]));
    }
  });

  it("widget'lar faqat mazmuniga mos mavzularda", () => {
    const widgetsOf = (bookId: string) =>
      TOPICS.filter((t) => t.bookId === bookId).flatMap((t) =>
        t.blocks.flatMap((b) => (b.type === "widget" ? [b.kind] : [])),
      );
    expect(new Set(widgetsOf("algebra-9"))).toEqual(new Set(["quadratic-graph"]));
    expect(new Set(widgetsOf("geometry-9"))).toEqual(new Set(["geometry-points"]));
    expect(new Set(widgetsOf("english-9"))).toEqual(new Set(["choice-explain"]));
    expect(new Set(widgetsOf("history-9"))).toEqual(new Set(["timeline"]));
    expect(widgetsOf("history-9")).toHaveLength(3);
  });

  it("Tarix: har mavzuda 'Asosiy sanalar va tushunchalar' qoidasi, formulasiz", () => {
    for (const topic of TOPICS.filter((t) => t.bookId === "history-9")) {
      const rules = topic.blocks.filter((b) => b.type === "rule");
      expect(rules.length).toBeGreaterThan(0);
      expect(rules.some((b) => b.title?.uz === "Asosiy sanalar va tushunchalar")).toBe(true);
      expect(rules.every((b) => b.formula === undefined)).toBe(true);
    }
  });

  it("Viyet mavzusida formula, misol va widget bor", () => {
    const types = new Set(TOPICS.find((t) => t.id === VIETA_TOPIC_ID)!.blocks.map((b) => b.type));
    for (const type of [
      "goal",
      "explanation",
      "rule",
      "example",
      "exercise",
      "summary",
      "widget",
    ]) {
      expect(types.has(type as never)).toBe(true);
    }
  });
});

describe("sxemalar noto'g'ri ma'lumotni rad etadi", () => {
  const book = BOOKS[0];

  it("noma'lum sinf", () => {
    expect(() => validate(bookSchema, { ...book, grade: 12 })).toThrow();
  });

  it("noma'lum kalit (strict)", () => {
    expect(() => validate(bookSchema, { ...book, extra: 1 })).toThrow();
  });

  it("uz matni yo'q", () => {
    expect(() => validate(bookSchema, { ...book, title: { ru: "x" } })).toThrow();
  });

  it("noma'lum blok turi", () => {
    expect(() => validate(topicBlockSchema, { id: "x", type: "video" })).toThrow();
  });

  it("choice javob indeksi variantlardan tashqarida", () => {
    const exercise = {
      id: "e",
      type: "exercise",
      answerType: "choice",
      question: { uz: "?" },
      options: [{ uz: "a" }, { uz: "b" }],
      answer: 2,
    };
    expect(() => validate(topicBlockSchema, exercise)).toThrow();
    expect(() => validate(topicBlockSchema, { ...exercise, answer: 1 })).not.toThrow();
  });

  it("noma'lum mashq turi", () => {
    const exercise = { id: "e", type: "exercise", answerType: "essay", question: { uz: "?" } };
    expect(() => validate(topicBlockSchema, exercise)).toThrow();
  });
});
