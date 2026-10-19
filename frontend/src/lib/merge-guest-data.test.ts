import { describe, expect, it } from "vitest";
import { MockApi } from "@/mocks/mock-api";
import type { Progress } from "@/types/progress";
import {
  collectGuestData,
  hasGuestData,
  mergeGuestData,
  mergeProgress,
  type GuestProgress,
} from "./merge-guest-data";

const TOPIC = "algebra-9-viyet-teoremasi";
const OTHER_TOPIC = "geometry-9-pifagor-teoremasi";

const account = (patch: Partial<Progress> = {}): Progress => ({
  userId: "u",
  topicId: TOPIC,
  readStatus: "none",
  exerciseStatus: "none",
  updatedAt: "2026-01-02T00:00:00.000Z",
  mistakes: [],
  ...patch,
});

const guest = (patch: Partial<GuestProgress> = {}): GuestProgress => ({
  mistakes: [],
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...patch,
});

describe("mergeProgress", () => {
  it("akkaunt bo'sh bo'lsa mehmon qiymatlarini oladi", () => {
    expect(
      mergeProgress(
        TOPIC,
        undefined,
        guest({ readStatus: "started", exerciseStatus: "in_progress", mistakes: ["e1"] }),
      ),
    ).toEqual({
      topicId: TOPIC,
      readStatus: "started",
      exerciseStatus: "in_progress",
      mistakes: ["e1"],
    });
  });

  it("holat pasaymaydi: akkauntdagi 'completed' mehmonning 'started' idan ustun", () => {
    const merged = mergeProgress(
      TOPIC,
      account({ readStatus: "completed", exerciseStatus: "completed" }),
      guest({ readStatus: "started", exerciseStatus: "in_progress" }),
    );
    expect(merged).toBeNull();
  });

  it("xatolar birlashtiriladi, takrorlanmaydi", () => {
    const merged = mergeProgress(
      TOPIC,
      account({ mistakes: ["e1"] }),
      guest({ mistakes: ["e1", "e2"] }),
    );
    expect(merged?.mistakes).toEqual(["e1", "e2"]);
  });

  it("lastBlockId faqat mehmon yozuvi yangiroq bo'lsa almashadi", () => {
    const newerGuest = guest({ lastBlockId: "g", updatedAt: "2026-02-01T00:00:00.000Z" });
    expect(mergeProgress(TOPIC, account({ lastBlockId: "a" }), newerGuest)?.lastBlockId).toBe("g");
    const olderGuest = guest({ lastBlockId: "g", updatedAt: "2025-01-01T00:00:00.000Z" });
    expect(mergeProgress(TOPIC, account({ lastBlockId: "a" }), olderGuest)).toBeNull();
  });
});

describe("collectGuestData", () => {
  it("o'qish pozitsiyasidan readStatus va lastBlockId hosil qiladi", () => {
    const data = collectGuestData(
      { progress: {}, bookmarks: [] },
      {
        [TOPIC]: { scroll: 0.5, lastBlockId: "rule", updatedAt: "2026-01-01T00:00:00.000Z" },
        [OTHER_TOPIC]: { scroll: 1, updatedAt: "2026-01-01T00:00:00.000Z" },
      },
    );
    expect(data.progress[TOPIC]).toMatchObject({ readStatus: "started", lastBlockId: "rule" });
    expect(data.progress[OTHER_TOPIC].readStatus).toBe("completed");
  });

  it("mashq natijasi bilan birlashadi", () => {
    const data = collectGuestData(
      {
        progress: { [TOPIC]: guest({ exerciseStatus: "in_progress", mistakes: ["e1"] }) },
        bookmarks: [],
      },
      { [TOPIC]: { scroll: 0.2, lastBlockId: "x", updatedAt: "2026-03-01T00:00:00.000Z" } },
    );
    expect(data.progress[TOPIC]).toMatchObject({
      exerciseStatus: "in_progress",
      mistakes: ["e1"],
      readStatus: "started",
      lastBlockId: "x",
    });
  });
});

describe("hasGuestData", () => {
  it("bo'sh va to'la holatni ajratadi", () => {
    expect(hasGuestData({ progress: {}, bookmarks: [] })).toBe(false);
    expect(hasGuestData({ progress: {}, bookmarks: [TOPIC] })).toBe(true);
  });
});

describe("mergeGuestData (MockApi bilan)", () => {
  const signedIn = () => new MockApi({ session: () => ({ id: "u1", name: "Aziza" }) });
  const data = {
    progress: { [TOPIC]: guest({ readStatus: "started", lastBlockId: "rule", mistakes: ["e1"] }) },
    bookmarks: [TOPIC],
  };

  it("progress va xatcho'plarni akkauntga qo'shadi", async () => {
    const api = signedIn();
    const result = await mergeGuestData(api, data);
    expect(result).toEqual({ progress: 1, bookmarks: 1, failed: [] });
    expect(await api.getProgress({ topicId: TOPIC })).toMatchObject([
      { readStatus: "started", lastBlockId: "rule", mistakes: ["e1"] },
    ]);
    expect(await api.getBookmarks()).toHaveLength(1);
  });

  it("takror chaqirilsa xatcho'pni o'chirib yubormaydi (idempotent)", async () => {
    const api = signedIn();
    await mergeGuestData(api, data);
    const again = await mergeGuestData(api, data);
    expect(again).toEqual({ progress: 0, bookmarks: 0, failed: [] });
    expect(await api.getBookmarks()).toHaveLength(1);
  });

  it("akkauntdagi mavjud xatcho'p toggle qilinmaydi", async () => {
    const api = signedIn();
    await api.toggleBookmark(TOPIC);
    await mergeGuestData(api, { progress: {}, bookmarks: [TOPIC] });
    expect(await api.getBookmarks()).toHaveLength(1);
  });

  it("mavjud bo'lmagan mavzu failed ro'yxatiga tushadi, qolganlari qo'shiladi", async () => {
    const api = signedIn();
    const result = await mergeGuestData(api, { progress: {}, bookmarks: ["yo'q", TOPIC] });
    expect(result).toEqual({ progress: 0, bookmarks: 1, failed: ["yo'q"] });
  });
});
