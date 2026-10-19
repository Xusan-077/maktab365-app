import { array, boolean, lazy, mixed, number, object, string, type ObjectShape } from "yup";
import { GRADES } from "@/types/catalog";
import { CONTENT_STATUSES, WIDGET_KINDS } from "@/types/topic";

/**
 * Domen tiplarining ish vaqtidagi sxemalari (yup). Mock ma'lumot va keyinchalik HttpApi javoblarini
 * tekshirish uchun. Barcha obyektlar `strict` va noma'lum kalitlarni rad etadi.
 */

export const obj = <T extends ObjectShape>(shape: T) => object(shape).noUnknown(true).strict(true);

const id = () => string().required().min(1);
const isoDate = () =>
  string()
    .required()
    .test("iso-date", "ISO sana bo'lishi kerak", (value) => !Number.isNaN(Date.parse(value)));

export const localizedTextSchema = obj({
  uz: string().required().min(1),
  // Tarjima keyin to'ldiriladi: bo'sh qator ham ruxsat, o'qishda uz'ga fallback qilinadi.
  ru: string(),
  en: string(),
}).required();

const gradeSchema = number()
  .required()
  .oneOf([...GRADES]);

export const subjectSchema = obj({
  id: id(),
  slug: string()
    .required()
    .matches(/^[a-z0-9-]+$/),
  name: localizedTextSchema,
});

export const bookSchema = obj({
  id: id(),
  title: localizedTextSchema,
  grade: gradeSchema,
  subjectId: id(),
  author: localizedTextSchema,
  coverUrl: string().url(),
  publishedYear: number().required().integer().min(1990).max(2100),
  edition: localizedTextSchema,
  pdfUrl: string().url(),
  topicsReady: boolean().required(),
});

export const topicSummarySchema = obj({
  id: id(),
  bookId: id(),
  chapterId: id(),
  order: number().required().integer().min(1),
  title: localizedTextSchema,
  ready: boolean().required(),
});

export const chapterSchema = obj({
  id: id(),
  bookId: id(),
  order: number().required().integer().min(1),
  title: localizedTextSchema,
  topics: array().of(topicSummarySchema).required(),
});

const blockShape = (type: string) => ({ id: id(), type: string().required().oneOf([type]) });

const exerciseShape = {
  ...blockShape("exercise"),
  question: localizedTextSchema,
  hint: localizedTextSchema.optional().default(undefined),
  explanation: localizedTextSchema.optional().default(undefined),
};

const exerciseSchemas = {
  choice: obj({
    ...exerciseShape,
    answerType: string().required().oneOf(["choice"]),
    options: array().of(localizedTextSchema).required().min(2),
    answer: number().required().integer().min(0),
  }).test(
    "answer-in-options",
    "Javob indeksi variantlar ichida bo'lishi kerak",
    (value) => value.answer < (value.options?.length ?? 0),
  ),
  input: obj({
    ...exerciseShape,
    answerType: string().required().oneOf(["input"]),
    answer: array().of(string().required().min(1)).required().min(1),
  }),
  truefalse: obj({
    ...exerciseShape,
    answerType: string().required().oneOf(["truefalse"]),
    answer: boolean().required(),
  }),
  order: obj({
    ...exerciseShape,
    answerType: string().required().oneOf(["order"]),
    items: array().of(localizedTextSchema).required().min(2),
    answer: array().of(number().required().integer().min(0)).required().min(2),
  }).test(
    "answer-is-permutation",
    "Javob items indekslarining to'liq almashtirishi bo'lishi kerak",
    (value) => {
      const count = value.items?.length ?? 0;
      const answer = value.answer ?? [];
      return (
        answer.length === count &&
        new Set(answer).size === count &&
        answer.every((index) => index < count)
      );
    },
  ),
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

function hasValidWidgetProps({ kind, props }: { kind?: string; props?: unknown }) {
  if (!isRecord(props)) return false;
  if (kind === "quadratic-graph") {
    return ["a", "b", "c"].every((key) => typeof props[key] === "number");
  }
  if (kind === "choice-explain") {
    const options = props.options;
    return (
      typeof props.prompt === "string" &&
      Array.isArray(options) &&
      options.length >= 2 &&
      options.filter((option) => isRecord(option) && option.correct === true).length === 1
    );
  }
  if (kind === "geometry-points") {
    const points = props.points;
    return (
      Array.isArray(points) &&
      points.length === 3 &&
      points.every(
        (point) =>
          isRecord(point) &&
          typeof point.label === "string" &&
          Number.isInteger(point.x) &&
          Number.isInteger(point.y),
      )
    );
  }
  if (kind === "timeline") {
    const events = props.events;
    return (
      Array.isArray(events) &&
      events.length >= 2 &&
      events.every(
        (event) =>
          isRecord(event) &&
          typeof event.id === "string" &&
          Number.isInteger(event.sortKey) &&
          [event.date, event.title, event.description].every(
            (text) => isRecord(text) && typeof text.uz === "string" && text.uz.trim() !== "",
          ),
      )
    );
  }
  return false;
}

const blockSchemas = {
  goal: obj({ ...blockShape("goal"), text: localizedTextSchema }),
  explanation: obj({
    ...blockShape("explanation"),
    title: localizedTextSchema.optional().default(undefined),
    text: localizedTextSchema,
  }),
  rule: obj({
    ...blockShape("rule"),
    title: localizedTextSchema.optional().default(undefined),
    text: localizedTextSchema,
    formula: string().min(1),
  }),
  example: obj({
    ...blockShape("example"),
    title: localizedTextSchema.optional().default(undefined),
    steps: array()
      .of(obj({ text: localizedTextSchema, formula: string().min(1) }))
      .required()
      .min(1),
  }),
  summary: obj({
    ...blockShape("summary"),
    points: array().of(localizedTextSchema).required().min(1),
  }),
  widget: obj({
    ...blockShape("widget"),
    kind: string()
      .required()
      .oneOf([...WIDGET_KINDS]),
    props: object().required(),
  }).test("widget-props", "Widget props kind'ga mos emas", (value) => hasValidWidgetProps(value)),
} as const;

export const topicBlockSchema = lazy(
  (value: { type?: string; answerType?: string } | undefined) => {
    const schema =
      value?.type === "exercise"
        ? exerciseSchemas[value.answerType as keyof typeof exerciseSchemas]
        : blockSchemas[value?.type as keyof typeof blockSchemas];
    return schema ?? mixed().test("block-type", "Noma'lum blok turi", () => false);
  },
);

export const topicSchema = topicSummarySchema.concat(
  obj({
    status: string()
      .required()
      .oneOf([...CONTENT_STATUSES]),
    blocks: array().of(topicBlockSchema).required(),
  }),
);

export const userSchema = lazy((value: { role?: string } | undefined) =>
  value?.role === "teacher"
    ? obj({
        id: id(),
        role: string().required().oneOf(["teacher"]),
        name: string().required().min(1),
        subjects: array().of(id()),
        grades: array().of(gradeSchema),
      })
    : obj({
        id: id(),
        role: string().required().oneOf(["student"]),
        name: string().required().min(1),
        grade: gradeSchema.optional().default(undefined),
      }),
);

export const progressSchema = obj({
  userId: id(),
  topicId: id(),
  readStatus: string().required().oneOf(["none", "started", "completed"]),
  exerciseStatus: string().required().oneOf(["none", "in_progress", "completed"]),
  lastBlockId: string().min(1),
  updatedAt: isoDate(),
  mistakes: array().of(id()).required(),
  solved: array().of(id()),
  attempts: object().optional(),
});

export const bookmarkSchema = obj({
  id: id(),
  userId: id(),
  topicId: id(),
  createdAt: isoDate(),
});
