import { describe, expect, it } from "vitest";
import type { Progress } from "@/types/progress";
import { weeklySummary } from "./summary";

const NOW = new Date("2026-03-10T12:00:00.000Z");

const progress = (topicId: string, patch: Partial<Progress> = {}): Progress => ({
  userId: "u",
  topicId,
  readStatus: "none",
  exerciseStatus: "none",
  updatedAt: "2026-03-09T12:00:00.000Z",
  mistakes: [],
  ...patch,
});

describe("weeklySummary", () => {
  it("faqat oxirgi 7 kundagi harakatlarni sanaydi", () => {
    const summary = weeklySummary(
      [
        progress("a", {
          readStatus: "completed",
          exerciseStatus: "completed",
          updatedAt: "2026-03-09T00:00:00.000Z",
        }),
        progress("b", {
          readStatus: "completed",
          exerciseStatus: "in_progress",
          mistakes: ["e1", "e2"],
          updatedAt: "2026-03-05T00:00:00.000Z",
        }),
        progress("old", {
          readStatus: "completed",
          exerciseStatus: "completed",
          updatedAt: "2026-02-20T00:00:00.000Z",
        }),
        progress("empty", { updatedAt: "2026-03-09T00:00:00.000Z" }),
      ],
      NOW,
    );
    expect(summary).toEqual({
      finished: 1,
      read: 2,
      exercisesPassed: 1,
      mistakes: 2,
      active: 2,
    });
  });
});
