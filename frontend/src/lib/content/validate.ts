import { array, number, string, ValidationError } from "yup";
import { localizedTextSchema, obj, topicBlockSchema } from "@/lib/api/schemas";
import { SECTION_KEYS, sectionOf } from "@/lib/utils/topic-sections";
import { CONTENT_STATUSES, type TopicBlock } from "@/types/topic";

/** Kontent faylidagi bitta muammo: maydon yo'li (`blocks[3].hint`) va sababi. */
export interface ContentIssue {
  path: string;
  message: string;
}

export const topicFileSchema = obj({
  status: string()
    .required()
    .oneOf([...CONTENT_STATUSES]),
  order: number().required().integer().min(1),
  title: localizedTextSchema,
  notes: array().of(string().required().min(1)),
  blocks: array().of(topicBlockSchema).required().min(1),
});

export const chapterFileSchema = obj({
  order: number().required().integer().min(1),
  title: localizedTextSchema,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isBlank = (value: unknown) => typeof value !== "string" || value.trim() === "";

function schemaIssues(
  schema: { validateSync: (value: unknown, options: object) => unknown },
  data: unknown,
): ContentIssue[] {
  try {
    schema.validateSync(data, { strict: true, abortEarly: false });
    return [];
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error;
    const inner = error.inner.length > 0 ? error.inner : [error];
    return inner.map((item) => ({ path: item.path || "(fayl)", message: item.message }));
  }
}

/**
 * `{ uz: "…" }` ko'rinishidagi har bir matnda `uz` bo'sh bo'lmasligi kerak (yup faqat uzunlikni
 * tekshiradi, "   " ni o'tkazib yuboradi). Tarjima (`ru`, `en`) bo'sh bo'lishi mumkin.
 */
function blankTextIssues(value: unknown, path: string): ContentIssue[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => blankTextIssues(item, `${path}[${index}]`));
  }
  if (!isRecord(value)) return [];
  if ("uz" in value && typeof value.uz === "string") {
    return isBlank(value.uz)
      ? [{ path: `${path}.uz`, message: "matn bo'sh bo'lmasligi kerak" }]
      : [];
  }
  return Object.entries(value).flatMap(([key, item]) =>
    blankTextIssues(item, path ? `${path}.${key}` : key),
  );
}

function blockIssues(blocks: TopicBlock[]): ContentIssue[] {
  const issues: ContentIssue[] = [];

  const seen = new Set<string>();
  blocks.forEach((block, index) => {
    if (seen.has(block.id)) {
      issues.push({ path: `blocks[${index}].id`, message: `blok id takrorlangan: "${block.id}"` });
    }
    seen.add(block.id);
  });

  // 7 bo'lim tartibi: goal → explanation → rule → example → exercise → summary (7-si, "next", sahifada o'zi chiziladi).
  let previous = -1;
  blocks.forEach((block, index) => {
    const position = SECTION_KEYS.indexOf(sectionOf(block));
    if (position < previous) {
      issues.push({
        path: `blocks[${index}]`,
        message: `blok tartibi noto'g'ri: "${sectionOf(block)}" bo'limi "${SECTION_KEYS[previous]}" dan keyin kelmasligi kerak (tartib: ${SECTION_KEYS.join(" → ")})`,
      });
    }
    previous = Math.max(previous, position);
  });

  for (const key of SECTION_KEYS) {
    const count = blocks.filter((block) => sectionOf(block) === key).length;
    if (count === 0) issues.push({ path: "blocks", message: `"${key}" bloki yo'q` });
    if ((key === "goal" || key === "summary") && count > 1) {
      issues.push({
        path: "blocks",
        message: `"${key}" bloki bitta bo'lishi kerak (${count} ta bor)`,
      });
    }
  }

  const exercises = blocks.flatMap((block, index) =>
    block.type === "exercise" ? [{ block, index }] : [],
  );
  if (exercises.length < 3) {
    issues.push({
      path: "blocks",
      message: `kamida 3 ta mashq kerak (${exercises.length} ta bor)`,
    });
  }
  for (const { block, index } of exercises) {
    if (isBlank(block.hint?.uz)) {
      issues.push({
        path: `blocks[${index}].hint`,
        message: "mashqda hint (maslahat) bo'lishi kerak",
      });
    }
    if (isBlank(block.explanation?.uz)) {
      issues.push({
        path: `blocks[${index}].explanation`,
        message: "mashqda explanation (tushuntirish) bo'lishi kerak",
      });
    }
    if (block.answerType === "order" && block.answer.every((item, i) => item === i)) {
      issues.push({
        path: `blocks[${index}].items`,
        message: "items allaqachon to'g'ri tartibda: mashq aralash tartibda berilishi kerak",
      });
    }
  }

  blocks.forEach((block, index) => {
    if (block.type !== "widget" || block.kind !== "timeline") return;
    const { events } = block.props;
    events.forEach((event, i) => {
      if (i > 0 && event.sortKey <= events[i - 1].sortKey) {
        issues.push({
          path: `blocks[${index}].props.events[${i}].sortKey`,
          message: "voqealar sortKey (sana) bo'yicha o'sish tartibida bo'lishi kerak",
        });
      }
    });
    if (new Set(events.map((event) => event.id)).size !== events.length) {
      issues.push({ path: `blocks[${index}].props.events`, message: "voqea id'lari takrorlangan" });
    }
  });

  return issues;
}

/** Mavzu faylini tekshiradi: sxema (yup) + kontent qoidalari. Bo'sh ro'yxat — xato yo'q. */
export function validateTopicFile(data: unknown): ContentIssue[] {
  const issues = schemaIssues(topicFileSchema, data);
  if (issues.length > 0 || !isRecord(data)) return issues;

  const file = data as unknown as { status: string; notes?: string[]; blocks: TopicBlock[] };
  const extra = [...blankTextIssues(data, ""), ...blockIssues(file.blocks)];
  if (file.status === "reviewed" && (file.notes?.length ?? 0) > 0) {
    extra.push({
      path: "notes",
      message: `status "reviewed", lekin ${file.notes!.length} ta ochiq izoh (TODO) bor`,
    });
  }
  return extra;
}

export function validateChapterFile(data: unknown): ContentIssue[] {
  const issues = schemaIssues(chapterFileSchema, data);
  return issues.length > 0 ? issues : blankTextIssues(data, "");
}

export interface ContentFileEntry {
  /** `src/content` ga nisbatan yo'l, kengaytmasiz: `algebra/algebra-9/kvadrat-tenglamalar/viyet-teoremasi`. */
  key: string;
  data: unknown;
}

export const CHAPTER_FILE_NAME = "chapter";
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export interface ContentTreeOptions {
  /** `kitob id → fan slug`: papka nomlari shu bilan solishtiriladi. */
  books: ReadonlyMap<string, string>;
}

export interface ContentTreeIssue extends ContentIssue {
  /** Muammoli fayl (`key`); butun daraxtga oid bo'lsa papka yo'li. */
  key: string;
}

/**
 * Faylarning joylashuvi va o'zaro bog'liqligi: yo'l shakli (`fan/kitob/bob/mavzu`), kitob va fan
 * mosligi, har bobda `chapter.json`, `order` lar 1…n bo'yicha takrorlanmasligi.
 */
export function validateContentTree(
  entries: ContentFileEntry[],
  { books }: ContentTreeOptions,
): ContentTreeIssue[] {
  const issues: ContentTreeIssue[] = [];
  const add = (key: string, path: string, message: string) => issues.push({ key, path, message });

  const chapters = new Map<string, { order: number; topics: { key: string; order: number }[] }>();
  const orderOf = (data: unknown) =>
    isRecord(data) && typeof data.order === "number" ? data.order : null;

  for (const { key, data } of entries) {
    const parts = key.split("/");
    if (parts.length !== 4) {
      add(key, "(yo'l)", "yo'l `fan/kitob/bob/mavzu` ko'rinishida bo'lishi kerak");
      continue;
    }
    const [subject, bookId, chapter, name] = parts;
    for (const part of parts) {
      if (!KEBAB.test(part)) add(key, "(yo'l)", `"${part}" kebab-case bo'lishi kerak`);
    }
    const subjectOfBook = books.get(bookId);
    if (subjectOfBook === undefined) {
      add(key, "(yo'l)", `"${bookId}" id'li kitob mocks/data/books.ts da yo'q`);
    } else if (subjectOfBook !== subject) {
      add(key, "(yo'l)", `kitob "${bookId}" fani "${subjectOfBook}", papka esa "${subject}"`);
    }

    const chapterKey = `${subject}/${bookId}/${chapter}`;
    const entry = chapters.get(chapterKey) ?? { order: NaN, topics: [] };
    const order = orderOf(data);
    if (name === CHAPTER_FILE_NAME) entry.order = order ?? NaN;
    else if (order !== null) entry.topics.push({ key, order });
    chapters.set(chapterKey, entry);
  }

  const chaptersByBook = new Map<string, { chapterKey: string; order: number }[]>();
  for (const [chapterKey, chapter] of chapters) {
    if (Number.isNaN(chapter.order)) {
      add(chapterKey, "(papka)", `bobda ${CHAPTER_FILE_NAME}.json yo'q yoki order noto'g'ri`);
    } else {
      const bookKey = chapterKey.split("/").slice(0, 2).join("/");
      chaptersByBook.set(bookKey, [
        ...(chaptersByBook.get(bookKey) ?? []),
        { chapterKey, order: chapter.order },
      ]);
    }
    const orders = chapter.topics.map((topic) => topic.order).sort((a, b) => a - b);
    if (orders.some((order, index) => order !== index + 1)) {
      add(
        chapterKey,
        "(papka)",
        `mavzular order'i 1…${orders.length} bo'yicha takrorsiz bo'lishi kerak (hozir: ${orders.join(", ")})`,
      );
    }
  }
  for (const [bookKey, list] of chaptersByBook) {
    const orders = list.map((item) => item.order).sort((a, b) => a - b);
    if (orders.some((order, index) => order !== index + 1)) {
      add(
        bookKey,
        "(papka)",
        `boblar order'i 1…${orders.length} bo'yicha takrorsiz bo'lishi kerak (hozir: ${orders.join(", ")})`,
      );
    }
  }

  return issues;
}
