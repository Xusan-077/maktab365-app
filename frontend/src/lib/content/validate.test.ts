import { describe, expect, it } from "vitest";
import { CONTENT_REGISTRY } from "@/content/registry";
import {
  CHAPTER_FILE_NAME,
  validateChapterFile,
  validateContentTree,
  validateTopicFile,
} from "./validate";

const text = (uz: string) => ({ uz });

const exercise = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  type: "exercise",
  answerType: "truefalse",
  question: text("Savol?"),
  answer: true,
  hint: text("Maslahat"),
  explanation: text("Tushuntirish"),
  ...over,
});

/** To'g'ri mavzu: 7 blokdan 6 tasi (7-si, "next", sahifada o'zi chiziladi) va 3 mashq. */
type Block = Record<string, unknown> & { id: string; type: string };

function validTopic(): { status: string; order: number; title: { uz: string }; blocks: Block[] } {
  return {
    status: "draft",
    order: 1,
    title: text("Mavzu"),
    blocks: [
      { id: "goal", type: "goal", text: text("Maqsad") },
      { id: "explanation", type: "explanation", text: text("Tushuntirish") },
      { id: "rule", type: "rule", text: text("Qoida"), formula: "a^2" },
      { id: "example", type: "example", steps: [{ text: text("Qadam") }] },
      exercise("e1"),
      exercise("e2"),
      exercise("e3"),
      { id: "summary", type: "summary", points: [text("Xulosa")] },
    ],
  };
}

const paths = (data: unknown) => validateTopicFile(data).map((issue) => issue.path);
const messages = (data: unknown) => validateTopicFile(data).map((issue) => issue.message);

const withBlocks = (change: (blocks: Block[]) => Block[]) => ({
  ...validTopic(),
  blocks: change(validTopic().blocks),
});

describe("validateTopicFile: to'g'ri fayl", () => {
  it("to'g'ri mavzu xatosiz o'tadi", () => {
    expect(validateTopicFile(validTopic())).toEqual([]);
  });

  it("ru/en bo'sh yoki yo'q bo'lishi mumkin", () => {
    const topic = { ...validTopic(), title: { uz: "Mavzu", ru: "", en: "" } };
    expect(validateTopicFile(topic)).toEqual([]);
  });

  it("src/content dagi barcha haqiqiy mavzu fayllari o'tadi", () => {
    for (const [key, data] of Object.entries(CONTENT_REGISTRY)) {
      const file = key.endsWith(`/${CHAPTER_FILE_NAME}`)
        ? validateChapterFile(data)
        : validateTopicFile(data);
      expect({ key, file }).toEqual({ key, file: [] });
    }
  });
});

describe("validateTopicFile: noto'g'ri blok tartibi", () => {
  it("example exercise'dan keyin kelsa — xato, blok yo'li bilan", () => {
    const topic = withBlocks((blocks) => {
      const [example] = blocks.splice(3, 1);
      blocks.splice(4, 0, example);
      return blocks;
    });
    expect(paths(topic)).toContain("blocks[4]");
    expect(messages(topic).join()).toContain("blok tartibi noto'g'ri");
  });

  it("summary boshida bo'lsa — xato", () => {
    const topic = withBlocks((blocks) => [blocks[blocks.length - 1], ...blocks.slice(0, -1)]);
    expect(messages(topic).join()).toContain("blok tartibi noto'g'ri");
  });

  it("widget o'z bo'limiga qarab tartibga kiradi: rule-widget misoldan keyin kelsa — xato", () => {
    const widget = {
      id: "w",
      type: "widget",
      kind: "quadratic-graph",
      props: { a: 1, b: 0, c: -1 },
    };
    const topic = withBlocks((blocks) => [...blocks.slice(0, 4), widget, ...blocks.slice(4)]);
    expect(paths(topic)).toContain("blocks[4]");
  });

  it("bo'lim butunlay yo'q bo'lsa — qaysi bo'lim yo'qligi aytiladi", () => {
    const topic = withBlocks((blocks) => blocks.filter((block) => block.type !== "example"));
    expect(messages(topic)).toContain(`"example" bloki yo'q`);
  });

  it("goal ikki marta bo'lsa — xato", () => {
    const topic = withBlocks((blocks) => [
      blocks[0],
      { ...blocks[0], id: "goal-2" },
      ...blocks.slice(1),
    ]);
    expect(messages(topic).join()).toContain(`"goal" bloki bitta bo'lishi kerak`);
  });

  it("blok id takrorlansa — xato", () => {
    const topic = withBlocks((blocks) => blocks.map((block) => ({ ...block, id: "same" })));
    expect(messages(topic).join()).toContain("blok id takrorlangan");
  });
});

describe("validateTopicFile: mashqsiz va kam mashqli mavzu", () => {
  it("mashq yo'q — xato", () => {
    const topic = withBlocks((blocks) => blocks.filter((block) => block.type !== "exercise"));
    expect(messages(topic)).toContain("kamida 3 ta mashq kerak (0 ta bor)");
    expect(messages(topic)).toContain(`"exercise" bloki yo'q`);
  });

  it("2 ta mashq — kam", () => {
    const topic = withBlocks((blocks) => blocks.filter((block) => block.id !== "e3"));
    expect(messages(topic)).toContain("kamida 3 ta mashq kerak (2 ta bor)");
  });

  it("blocks butunlay bo'sh massiv — yup xatosi", () => {
    expect(paths({ ...validTopic(), blocks: [] })).toContain("blocks");
  });
});

describe("validateTopicFile: hint va tushuntirish", () => {
  const replaceExercise = (over: Record<string, unknown>) =>
    withBlocks((blocks) =>
      blocks.map((block) => (block.id === "e2" ? exercise("e2", over) : block)),
    );

  it("hint umuman yo'q — xato, maydon yo'li bilan", () => {
    const topic = replaceExercise({ hint: undefined });
    expect(paths(topic)).toContain("blocks[5].hint");
  });

  it("hint bo'sh qator — xato", () => {
    const topic = replaceExercise({ hint: text("") });
    expect(paths(topic).join()).toContain("blocks[5].hint");
  });

  it("hint faqat bo'shliqdan iborat — xato", () => {
    const topic = replaceExercise({ hint: text("   ") });
    expect(paths(topic)).toContain("blocks[5].hint.uz");
  });

  it("tushuntirish yo'q yoki bo'sh — xato", () => {
    expect(paths(replaceExercise({ explanation: undefined }))).toContain("blocks[5].explanation");
    expect(paths(replaceExercise({ explanation: text(" ") }))).toContain(
      "blocks[5].explanation.uz",
    );
  });

  it("boshqa matnlarda ham bo'sh uz qabul qilinmaydi", () => {
    const topic = withBlocks((blocks) => [
      { id: "goal", type: "goal", text: text("  ") },
      ...blocks.slice(1),
    ]);
    expect(paths(topic)).toContain("blocks[0].text.uz");
  });
});

describe("validateTopicFile: tartiblash mashqi va vaqt chizig'i", () => {
  const order = (answer: number[]) =>
    exercise("e3", {
      answerType: "order",
      items: [text("A"), text("B"), text("C")],
      answer,
    });
  const replaceThird = (block: unknown) =>
    withBlocks((blocks) => blocks.map((item) => (item.id === "e3" ? (block as Block) : item)));

  it("to'g'ri tartiblash mashqi o'tadi", () => {
    expect(validateTopicFile(replaceThird(order([2, 0, 1])))).toEqual([]);
  });

  it("javob almashtirish emas (takror indeks) — xato", () => {
    expect(validateTopicFile(replaceThird(order([0, 0, 1]))).length).toBeGreaterThan(0);
  });

  it("items allaqachon to'g'ri tartibda — xato", () => {
    expect(paths(replaceThird(order([0, 1, 2])))).toContain("blocks[6].items");
  });

  const timeline = (sortKeys: number[]) => ({
    id: "w",
    type: "widget",
    kind: "timeline",
    props: {
      events: sortKeys.map((sortKey, index) => ({
        id: `e${index}`,
        sortKey,
        date: text("Sana"),
        title: text("Voqea"),
        description: text("Izoh"),
      })),
    },
  });
  const withTimeline = (widget: unknown) =>
    withBlocks((blocks) => [...blocks.slice(0, 3), widget as Block, ...blocks.slice(3)]);

  it("tartiblangan timeline o'tadi", () => {
    expect(validateTopicFile(withTimeline(timeline([19910831, 19911229])))).toEqual([]);
  });

  it("tartibi buzilgan yoki bir xil sana — xato", () => {
    expect(paths(withTimeline(timeline([19911229, 19910831])))).toContain(
      "blocks[3].props.events[1].sortKey",
    );
    expect(paths(withTimeline(timeline([19910831, 19910831])))).toContain(
      "blocks[3].props.events[1].sortKey",
    );
  });

  it("bitta voqeali timeline — xato (kamida 2 ta)", () => {
    expect(validateTopicFile(withTimeline(timeline([19910831]))).length).toBeGreaterThan(0);
  });
});

describe("validateTopicFile: status va sxema", () => {
  it("status yo'q yoki noto'g'ri — xato", () => {
    expect(paths({ ...validTopic(), status: undefined })).toContain("status");
    expect(paths({ ...validTopic(), status: "final" })).toContain("status");
  });

  it("reviewed, lekin ochiq TODO izohlari bor — xato", () => {
    const topic = { ...validTopic(), status: "reviewed", notes: ["TODO: tekshirish"] };
    expect(paths(topic)).toContain("notes");
    expect(validateTopicFile({ ...validTopic(), status: "reviewed" })).toEqual([]);
  });

  it("noma'lum kalit rad etiladi", () => {
    expect(validateTopicFile({ ...validTopic(), extra: 1 }).length).toBeGreaterThan(0);
  });

  it("JSON obyekt emas — xato", () => {
    expect(validateTopicFile(null).length).toBeGreaterThan(0);
    expect(validateTopicFile([]).length).toBeGreaterThan(0);
  });
});

describe("validateChapterFile", () => {
  it("to'g'ri bob o'tadi, sarlavhasiz bob — xato", () => {
    expect(validateChapterFile({ order: 1, title: text("Bob") })).toEqual([]);
    expect(validateChapterFile({ order: 1 }).map((issue) => issue.path)).toContain("title");
    expect(validateChapterFile({ order: 1, title: text(" ") }).length).toBeGreaterThan(0);
  });
});

describe("validateContentTree", () => {
  const books = new Map([["algebra-9", "algebra"]]);
  const entry = (key: string, order = 1) => ({ key, data: { order } });
  const run = (keys: [string, number?][]) =>
    validateContentTree(
      keys.map(([key, order]) => entry(key, order)),
      { books },
    ).map((issue) => `${issue.key}: ${issue.message}`);

  it("to'g'ri daraxt xatosiz", () => {
    expect(run([["algebra/algebra-9/ch/chapter"], ["algebra/algebra-9/ch/a"]])).toEqual([]);
  });

  it("chapter.json yo'q bob — xato", () => {
    expect(run([["algebra/algebra-9/ch/a"]]).join()).toContain("chapter.json yo'q");
  });

  it("fan papkasi kitobning faniga mos kelmasa — xato", () => {
    const issues = run([["geometriya/algebra-9/ch/chapter"]]).join();
    expect(issues).toContain(`fani "algebra", papka esa "geometriya"`);
  });

  it("noma'lum kitob va noto'g'ri yo'l shakli — xato", () => {
    expect(run([["algebra/nomalum-9/ch/chapter"]]).join()).toContain("books.ts da yo'q");
    expect(run([["algebra/algebra-9/a"]]).join()).toContain("`fan/kitob/bob/mavzu`");
  });

  it("mavzu order'i 1…n emas yoki takror — xato", () => {
    const issues = run([
      ["algebra/algebra-9/ch/chapter"],
      ["algebra/algebra-9/ch/a", 1],
      ["algebra/algebra-9/ch/b", 1],
    ]).join();
    expect(issues).toContain("mavzular order'i");
  });

  it("kebab-case bo'lmagan nom — xato", () => {
    expect(
      run([["algebra/algebra-9/ch/chapter"], ["algebra/algebra-9/ch/MavzuA"]]).join(),
    ).toContain("kebab-case");
  });
});
