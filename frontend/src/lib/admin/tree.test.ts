import { describe, expect, it } from "vitest";
import { buildTree, diffToReorder, moveChapter, moveTopic } from "./tree";
import type { AdminChapter, AdminTopicItem } from "./types";

const chapter = (id: string, order: number) =>
  ({ id, slug: id, title: { uz: id }, order }) as AdminChapter;
const topic = (id: string, chapterId: string, order: number) =>
  ({ id, slug: id, chapter: chapterId, title: { uz: id }, order }) as AdminTopicItem;

const tree = () =>
  buildTree(
    [chapter("c2", 2), chapter("c1", 1)],
    [topic("t3", "c2", 1), topic("t2", "c1", 2), topic("t1", "c1", 1)],
  );

const shape = (t: ReturnType<typeof tree>) =>
  t.map((c) => `${c.id}:${c.topics.map((x) => x.id).join(",")}`);

describe("tree", () => {
  it("buildTree tartiblaydi", () => {
    expect(shape(tree())).toEqual(["c1:t1,t2", "c2:t3"]);
  });

  it("moveChapter bobni ko'chiradi; o'sha joyga — o'zgarishsiz", () => {
    const base = tree();
    expect(shape(moveChapter(base, "c2", 0))).toEqual(["c2:t3", "c1:t1,t2"]);
    expect(moveChapter(base, "c1", 0)).toBe(base);
    expect(moveChapter(base, "c2", 99)).toBe(base); // oxiriga qisqartiriladi — joyida
  });

  it("moveTopic: bob ichida va boshqa bobga", () => {
    const base = tree();
    expect(shape(moveTopic(base, "t2", "c1", 0))).toEqual(["c1:t2,t1", "c2:t3"]);
    const moved = moveTopic(base, "t1", "c2", 1);
    expect(shape(moved)).toEqual(["c1:t2", "c2:t3,t1"]);
    expect(moved[1].topics[1].chapter).toBe("c2");
    expect(moveTopic(base, "t1", "c1", 0)).toBe(base);
    expect(moveTopic(base, "yoq", "c1", 0)).toBe(base);
  });

  it("diffToReorder faqat o'zgargan qismni yuboradi", () => {
    const base = tree();
    expect(diffToReorder(base, base)).toBeNull();
    expect(diffToReorder(base, moveChapter(base, "c2", 0))).toEqual({ chapters: ["c2", "c1"] });
    expect(diffToReorder(base, moveTopic(base, "t2", "c1", 0))).toEqual({
      topics: { c1: ["t2", "t1"] },
    });
    expect(diffToReorder(base, moveTopic(base, "t1", "c2", 0))).toEqual({
      topics: { c1: ["t2"], c2: ["t1", "t3"] },
    });
  });
});
