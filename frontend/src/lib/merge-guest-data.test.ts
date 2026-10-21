import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MockApi } from "@/mocks/mock-api";
import type { GuestProgress, Progress } from "@/types/progress";
import { collectGuestData, hasGuestData, mergeBookmarks, mergeProgress } from "./merge-guest-data";

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

describe("MockApi.mergeGuestData", () => {
  const signedIn = () => new MockApi({ session: () => ({ id: "u1", name: "Aziza" }) });
  const data = {
    progress: { [TOPIC]: guest({ readStatus: "started", lastBlockId: "rule", mistakes: ["e1"] }) },
    bookmarks: [TOPIC],
  };

  it("progress va xatcho'plarni akkauntga qo'shadi", async () => {
    const api = signedIn();
    const result = await api.mergeGuestData(data);
    expect(result).toEqual({ progress: 1, bookmarks: 1, failed: [] });
    expect(await api.getProgress({ topicId: TOPIC })).toMatchObject([
      { readStatus: "started", lastBlockId: "rule", mistakes: ["e1"] },
    ]);
    expect(await api.getBookmarks()).toHaveLength(1);
  });

  it("takror chaqirilsa xatcho'pni o'chirib yubormaydi (idempotent)", async () => {
    const api = signedIn();
    await api.mergeGuestData(data);
    const again = await api.mergeGuestData(data);
    expect(again).toEqual({ progress: 0, bookmarks: 0, failed: [] });
    expect(await api.getBookmarks()).toHaveLength(1);
  });

  it("akkauntdagi mavjud xatcho'p toggle qilinmaydi", async () => {
    const api = signedIn();
    await api.toggleBookmark(TOPIC);
    await api.mergeGuestData({ progress: {}, bookmarks: [TOPIC] });
    expect(await api.getBookmarks()).toHaveLength(1);
  });

  it("mavjud bo'lmagan mavzu failed ro'yxatiga tushadi, qolganlari qo'shiladi", async () => {
    const api = signedIn();
    const result = await api.mergeGuestData({ progress: {}, bookmarks: ["yo'q", TOPIC] });
    expect(result).toEqual({ progress: 0, bookmarks: 1, failed: ["yo'q"] });
  });
});

// Backend (`merge-guest-data/`) bilan umumiy qoidalar: contracts/fixtures/merge-*.json.
type FixtureState = {
  read_status: "not_started" | "in_progress" | "read";
  exercise_status: "not_started" | "in_progress" | "passed";
  last_block_id: string;
  mistakes: string[];
  solved: string[];
  attempts: Record<string, number>;
  updated_at: string;
};
type ProgressCase = {
  name: string;
  account: FixtureState | null;
  guest: FixtureState;
  merged: FixtureState;
};

const FIXTURES = join(process.cwd(), "..", "contracts", "fixtures");
const loadCases = <T>(name: string): T[] =>
  (JSON.parse(readFileSync(join(FIXTURES, name), "utf8")) as { cases: T[] }).cases;

const READ_FROM_FIXTURE = {
  not_started: "none",
  in_progress: "started",
  read: "completed",
} as const;
const EXERCISE_FROM_FIXTURE = {
  not_started: "none",
  in_progress: "in_progress",
  passed: "completed",
} as const;

const toGuest = (state: FixtureState): GuestProgress => ({
  readStatus: READ_FROM_FIXTURE[state.read_status],
  exerciseStatus: EXERCISE_FROM_FIXTURE[state.exercise_status],
  lastBlockId: state.last_block_id || undefined,
  mistakes: state.mistakes,
  solved: state.solved,
  attempts: state.attempts,
  updatedAt: state.updated_at,
});

const toAccount = (state: FixtureState): Progress => ({
  userId: "u",
  topicId: TOPIC,
  ...toGuest(state),
  readStatus: READ_FROM_FIXTURE[state.read_status],
  exerciseStatus: EXERCISE_FROM_FIXTURE[state.exercise_status],
  mistakes: state.mistakes,
});

describe("merge shartnomasi (contracts/fixtures/merge-progress.json)", () => {
  it.each(loadCases<ProgressCase>("merge-progress.json"))("$name", (item) => {
    const account = item.account ? toAccount(item.account) : undefined;
    const input = mergeProgress(TOPIC, account, toGuest(item.guest));

    // `null` — akkauntda o'zgarish kerak emas: natija akkauntning o'zi.
    const merged = {
      readStatus: input?.readStatus ?? account?.readStatus ?? "none",
      exerciseStatus: input?.exerciseStatus ?? account?.exerciseStatus ?? "none",
      lastBlockId: input?.lastBlockId ?? account?.lastBlockId ?? "",
      mistakes: [...(input?.mistakes ?? account?.mistakes ?? [])].sort(),
      solved: [...(input?.solved ?? account?.solved ?? [])].sort(),
      attempts: input?.attempts ?? account?.attempts ?? {},
    };
    expect(merged).toEqual({
      readStatus: READ_FROM_FIXTURE[item.merged.read_status],
      exerciseStatus: EXERCISE_FROM_FIXTURE[item.merged.exercise_status],
      lastBlockId: item.merged.last_block_id,
      mistakes: [...item.merged.mistakes].sort(),
      solved: [...item.merged.solved].sort(),
      attempts: item.merged.attempts,
    });
  });
});

describe("merge shartnomasi (contracts/fixtures/merge-bookmarks.json)", () => {
  type BookmarkCase = { name: string; account: string[]; guest: string[]; merged: string[] };
  it.each(loadCases<BookmarkCase>("merge-bookmarks.json"))("$name", (item) => {
    const added = mergeBookmarks(item.account, item.guest);
    expect([...new Set([...item.account, ...added])].sort()).toEqual([...item.merged].sort());
    // Akkauntda bor xatcho'p qayta qo'shilmaydi
    expect(added.filter((id) => item.account.includes(id))).toEqual([]);
  });
});
