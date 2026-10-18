import { describe, expect, it } from "vitest";
import type { TopicProgressEvent } from "./events";
import { applyToProgress, reduceTopic, type TopicState } from "./reduce";

const TOPIC = "t1";

const answer = (
  exerciseId: string,
  correct: boolean,
  attempt = 1,
  totalExercises = 2,
): TopicProgressEvent => ({
  type: "exercise_answered",
  topicId: TOPIC,
  exerciseId,
  correct,
  attempt,
  totalExercises,
});

/** Hodisalarni ketma-ket qo'llaydi. */
const run = (events: TopicProgressEvent[], from?: TopicState) =>
  events.reduce<TopicState | undefined>((state, event) => reduceTopic(state, event) ?? state, from);

describe("o'qish holati", () => {
  it("topic_opened mavzuni boshlangan qiladi, takror ochish o'zgartirmaydi", () => {
    const opened = reduceTopic(undefined, { type: "topic_opened", topicId: TOPIC });
    expect(opened?.readStatus).toBe("started");
    expect(reduceTopic(opened ?? undefined, { type: "topic_opened", topicId: TOPIC })).toBeNull();
  });

  it("reading_moved lastBlockId ni yozadi, bir xil blok bo'lsa o'zgarish yo'q", () => {
    const moved = reduceTopic(undefined, {
      type: "reading_moved",
      topicId: TOPIC,
      lastBlockId: "b2",
    });
    expect(moved).toMatchObject({ readStatus: "started", lastBlockId: "b2" });
    expect(
      reduceTopic(moved ?? undefined, { type: "reading_moved", topicId: TOPIC, lastBlockId: "b2" }),
    ).toBeNull();
  });

  it("topic_read (scroll va manual) o'qilgan qiladi va pastga tushmaydi", () => {
    for (const source of ["scroll", "manual"] as const) {
      const read = reduceTopic(undefined, { type: "topic_read", topicId: TOPIC, source });
      expect(read?.readStatus).toBe("completed");
      const moved = reduceTopic(read ?? undefined, {
        type: "reading_moved",
        topicId: TOPIC,
        lastBlockId: "b1",
      });
      expect(moved?.readStatus).toBe("completed");
    }
  });

  it("o'qish mashq holatiga tegmaydi", () => {
    const state = run([
      answer("e1", true),
      { type: "topic_read", topicId: TOPIC, source: "manual" },
    ]);
    expect(state).toMatchObject({ readStatus: "completed", exerciseStatus: "in_progress" });
  });
});

describe("mashq holati va xatolar", () => {
  it("xato javob mashqni mistakes[] ga qo'shadi va urinishni sanaydi", () => {
    const state = run([answer("e1", false), answer("e1", false, 2)]);
    expect(state?.mistakes).toEqual(["e1"]);
    expect(state?.attempts).toEqual({ e1: 2 });
    expect(state?.exerciseStatus).toBe("in_progress");
  });

  it("xato qilib keyin to'g'rilangan mashq xato bo'lib qoladi", () => {
    const state = run([answer("e1", false), answer("e1", true, 2)]);
    expect(state?.mistakes).toEqual(["e1"]);
    expect(state?.solved).toEqual(["e1"]);
  });

  it("keyingi ochilishda birinchi urinishda to'g'ri yechilsa xato o'chadi", () => {
    const before = run([answer("e1", false), answer("e1", true, 2)]);
    const after = run([answer("e1", true, 1)], before);
    expect(after?.mistakes).toEqual([]);
  });

  it("hamma mashq yechilsa mashqlar tugagan", () => {
    const state = run([answer("e1", true), answer("e2", true)]);
    expect(state?.exerciseStatus).toBe("completed");
  });

  it("tugagan holat qayta ochilganda pastga tushmaydi", () => {
    const done = run([answer("e1", true), answer("e2", true)]);
    const again = run([answer("e3", true, 1, 5)], done);
    expect(again?.exerciseStatus).toBe("completed");
  });

  it("mashqlar soni noma'lum (0) bo'lsa tugagan hisoblanmaydi", () => {
    expect(run([answer("e1", true, 1, 0)])?.exerciseStatus).toBe("in_progress");
  });
});

describe("applyToProgress", () => {
  const now = new Date("2026-03-10T12:00:00.000Z");

  it("to'liq yozuv yaratadi", () => {
    const next = applyToProgress(
      undefined,
      { type: "topic_opened", topicId: TOPIC },
      { userId: "u", now },
    );
    expect(next).toMatchObject({
      userId: "u",
      topicId: TOPIC,
      readStatus: "started",
      exerciseStatus: "none",
      mistakes: [],
      updatedAt: now.toISOString(),
    });
  });

  it("o'zgarish bo'lmasa null", () => {
    const first = applyToProgress(
      undefined,
      { type: "topic_opened", topicId: TOPIC },
      { userId: "u", now },
    );
    expect(
      applyToProgress(
        first ?? undefined,
        { type: "topic_opened", topicId: TOPIC },
        { userId: "u", now },
      ),
    ).toBeNull();
  });
});
