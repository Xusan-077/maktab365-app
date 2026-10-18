import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getApi } from "@/lib/api";
import { queryKeys } from "@/lib/api/query-keys";
import { setApiSession } from "@/lib/api/session";
import { useGuestStore } from "@/stores/guest.store";
import type { Bookmark, Progress } from "@/types/progress";
import { getSyncQueue, stopSync } from "./engine";
import { recordForAccount } from "./record";

const TOPIC = "algebra-9-viyet-teoremasi";

let queryClient: QueryClient;

beforeEach(() => {
  setApiSession({ id: "acc-1", name: "Aziza" });
  queryClient = new QueryClient();
});

afterEach(() => {
  stopSync();
  setApiSession(null);
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("recordForAccount", () => {
  it("avval keshga (optimistic), keyin navbat orqali API'ga yozadi", async () => {
    await recordForAccount(queryClient, "acc-1", { type: "topic_opened", topicId: TOPIC });
    const cached = queryClient.getQueryData<Progress[]>(queryKeys.progress());
    expect(cached?.[0]).toMatchObject({ topicId: TOPIC, readStatus: "started" });

    await getSyncQueue("acc-1", queryClient).flush();
    await settle();
    const saved = await getApi().getProgress();
    expect(saved.find((item) => item.topicId === TOPIC)?.readStatus).toBe("started");
    expect(getSyncQueue("acc-1", queryClient).pending).toEqual([]);
  });

  it("o'qish va mashq holatlari alohida, xato mistakes[] ga tushadi", async () => {
    const event = { topicId: TOPIC, exerciseId: "e1", totalExercises: 2 } as const;
    await recordForAccount(queryClient, "acc-1", {
      type: "topic_read",
      topicId: TOPIC,
      source: "manual",
    });
    await recordForAccount(queryClient, "acc-1", {
      type: "exercise_answered",
      ...event,
      correct: false,
      attempt: 1,
    });
    await getSyncQueue("acc-1", queryClient).flush();
    await settle();
    const saved = (await getApi().getProgress()).find((item) => item.topicId === TOPIC);
    expect(saved).toMatchObject({
      readStatus: "completed",
      exerciseStatus: "in_progress",
      mistakes: ["e1"],
      attempts: { e1: 1 },
    });
  });

  it("o'zgarishsiz hodisa navbatga tushmaydi", async () => {
    await recordForAccount(queryClient, "acc-1", { type: "topic_opened", topicId: TOPIC });
    const queue = getSyncQueue("acc-1", queryClient);
    await queue.flush();
    await recordForAccount(queryClient, "acc-1", { type: "topic_opened", topicId: TOPIC });
    expect(queue.pending).toEqual([]);
  });

  it("xatcho'p holat sifatida yoziladi va takror yuborilsa o'zgarmaydi", async () => {
    await recordForAccount(queryClient, "acc-1", {
      type: "bookmark_toggled",
      topicId: TOPIC,
      bookmarked: true,
    });
    expect(queryClient.getQueryData<Bookmark[]>(queryKeys.bookmarks())).toHaveLength(1);
    await recordForAccount(queryClient, "acc-1", {
      type: "bookmark_toggled",
      topicId: TOPIC,
      bookmarked: true,
    });
    await getSyncQueue("acc-1", queryClient).flush();
    await settle();
    expect((await getApi().getBookmarks()).filter((item) => item.topicId === TOPIC)).toHaveLength(
      1,
    );
  });
});

describe("mehmon (guest store.record)", () => {
  it("akkauntdagi bilan bir xil qoidalar bilan yozadi", () => {
    useGuestStore.getState().clear();
    const { record } = useGuestStore.getState();
    record({ type: "topic_opened", topicId: TOPIC });
    record({
      type: "exercise_answered",
      topicId: TOPIC,
      exerciseId: "e1",
      correct: false,
      attempt: 1,
      totalExercises: 1,
    });
    record({ type: "bookmark_toggled", topicId: TOPIC, bookmarked: true });
    record({ type: "bookmark_toggled", topicId: TOPIC, bookmarked: true });
    const { progress, bookmarks } = useGuestStore.getState();
    expect(progress[TOPIC]).toMatchObject({
      readStatus: "started",
      exerciseStatus: "in_progress",
      mistakes: ["e1"],
    });
    expect(bookmarks).toEqual([TOPIC]);
    useGuestStore.getState().clear();
  });
});
