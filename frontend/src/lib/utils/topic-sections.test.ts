import { describe, expect, it } from "vitest";
import type { TopicBlock } from "@/types/topic";
import { describeBlock, groupBlocks } from "./topic-sections";

const text = { uz: "x" };

describe("groupBlocks", () => {
  it("bloklarni belgilangan tartibda bo'limlarga ajratadi", () => {
    const blocks: TopicBlock[] = [
      { id: "s", type: "summary", points: [text] },
      { id: "e1", type: "exercise", answerType: "truefalse", question: text, answer: true },
      { id: "g", type: "goal", text },
      { id: "w", type: "widget", kind: "quadratic-graph", props: { a: 1, b: 0, c: 0 } },
      { id: "r", type: "rule", text },
    ];
    const groups = groupBlocks(blocks);
    expect(groups.map((group) => group.key)).toEqual(["goal", "rule", "exercise", "summary"]);
    // bo'lim ichida asl tartib saqlanadi
    expect(groups[1].blocks.map((block) => block.id)).toEqual(["w", "r"]);
  });
});

describe("describeBlock", () => {
  const blocks: TopicBlock[] = [
    { id: "g", type: "goal", text },
    { id: "x", type: "explanation", title: { uz: "Sarlavha" }, text },
    { id: "e1", type: "exercise", answerType: "truefalse", question: text, answer: true },
    { id: "e2", type: "exercise", answerType: "truefalse", question: text, answer: false },
  ];

  it("sarlavhali blokni sarlavhasi bilan tasvirlaydi", () => {
    expect(describeBlock(blocks, "x")).toEqual({
      section: "explanation",
      title: { uz: "Sarlavha" },
    });
    expect(describeBlock(blocks, "g")).toEqual({ section: "goal" });
  });

  it("mashq blokida tartib raqamini beradi", () => {
    expect(describeBlock(blocks, "e2")).toEqual({ section: "exercise", exerciseOrder: 2 });
  });

  it("nomalum blok uchun undefined", () => {
    expect(describeBlock(blocks, "nope")).toBeUndefined();
  });
});
