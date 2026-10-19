import { describe, expect, it } from "vitest";
import { MockApi } from "./mock-api";

const TOPIC = "algebra-9-viyet-teoremasi";
const api = () => new MockApi({ session: () => ({ id: "u1", name: "Aziza" }) });

describe("MockApi: progress shartnomasi", () => {
  it("holatlar pastga tushmaydi (boshqa qurilma oldinroq yuborgan bo'lishi mumkin)", async () => {
    const a = api();
    await a.saveProgress({ topicId: TOPIC, readStatus: "completed", exerciseStatus: "completed" });
    const next = await a.saveProgress({
      topicId: TOPIC,
      readStatus: "started",
      exerciseStatus: "in_progress",
    });
    expect(next).toMatchObject({ readStatus: "completed", exerciseStatus: "completed" });
  });

  it("yechilgan mashqlar birlashadi, urinishlar eng kattasini oladi, xatolar almashtiriladi", async () => {
    const a = api();
    await a.saveProgress({
      topicId: TOPIC,
      solved: ["e1"],
      attempts: { e1: 3 },
      mistakes: ["e1", "e2"],
    });
    const next = await a.saveProgress({
      topicId: TOPIC,
      solved: ["e2"],
      attempts: { e1: 1, e2: 1 },
      mistakes: ["e2"],
    });
    expect(next.solved?.sort()).toEqual(["e1", "e2"]);
    expect(next.attempts).toEqual({ e1: 3, e2: 1 });
    expect(next.mistakes).toEqual(["e2"]);
  });

  it("setBookmark aniq holatga keltiradi va takror yuborilsa o'zgarmaydi", async () => {
    const a = api();
    const first = await a.setBookmark(TOPIC, true);
    const again = await a.setBookmark(TOPIC, true);
    expect(again.bookmark?.id).toBe(first.bookmark?.id);
    expect(await a.getBookmarks()).toHaveLength(1);
    expect(await a.setBookmark(TOPIC, false)).toEqual({ bookmarked: false, bookmark: null });
    expect(await a.setBookmark(TOPIC, false)).toEqual({ bookmarked: false, bookmark: null });
    expect(await a.getBookmarks()).toEqual([]);
  });
});
