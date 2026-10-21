import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/types";
import {
  isPermanentError,
  overlayProgress,
  SyncQueue,
  type SyncApi,
  type SyncItem,
  type SyncQueueOptions,
} from "./queue";

const progressItem = (
  topicId: string,
  readStatus: "started" | "completed" = "started",
): SyncItem => ({
  kind: "progress",
  topicId,
  input: { topicId, readStatus },
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup(
  overrides: Partial<SyncApi> = {},
  online = { value: true },
  options: Partial<SyncQueueOptions> = {},
) {
  const api = {
    saveProgress: vi.fn().mockResolvedValue({}),
    setBookmark: vi.fn().mockResolvedValue({}),
    recordTopicOpened: vi.fn().mockResolvedValue({}),
    ...overrides,
  };
  const memory = new Map<string, string>();
  const storage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => void memory.set(key, value),
  };
  const timers: Array<{ callback: () => void; delay: number }> = [];
  const make = () =>
    new SyncQueue({
      api,
      storage,
      storageKey: "q",
      ...options,
      isOnline: () => online.value,
      schedule: (callback, delay) => {
        const entry = { callback, delay };
        timers.push(entry);
        return entry;
      },
      cancel: (handle) => {
        const index = timers.indexOf(handle as (typeof timers)[number]);
        if (index !== -1) timers.splice(index, 1);
      },
    });
  return { api, storage, timers, make, online };
}

describe("SyncQueue", () => {
  it("yozuvni darhol yuboradi va navbatdan chiqaradi", async () => {
    const { api, make } = setup();
    const queue = make();
    queue.enqueue(progressItem("a"));
    await queue.flush();
    expect(api.saveProgress).toHaveBeenCalledWith({ topicId: "a", readStatus: "started" });
    expect(queue.pending).toEqual([]);
  });

  it("bir mavzu uchun faqat eng so'nggi holat yuboriladi", async () => {
    const { api, make, online } = setup();
    online.value = false;
    const queue = make();
    queue.enqueue(progressItem("a", "started"));
    queue.enqueue(progressItem("a", "completed"));
    queue.enqueue({ kind: "bookmark", topicId: "a", bookmarked: true });
    queue.enqueue({ kind: "bookmark", topicId: "a", bookmarked: false });
    expect(queue.pending).toHaveLength(2);
    online.value = true;
    await queue.flush();
    expect(api.saveProgress).toHaveBeenCalledTimes(1);
    expect(api.saveProgress).toHaveBeenCalledWith({ topicId: "a", readStatus: "completed" });
    expect(api.setBookmark).toHaveBeenCalledWith("a", false);
  });

  it("oflayn bo'lsa yubormaydi, onlayn bo'lgach yuboradi; navbat saqlanadi", async () => {
    const { api, make, online, storage } = setup();
    online.value = false;
    const queue = make();
    queue.enqueue(progressItem("a"));
    await queue.flush();
    expect(api.saveProgress).not.toHaveBeenCalled();
    expect(storage.getItem("q")).toContain('"topicId":"a"');

    // sahifa qayta ochildi: navbat localStorage'dan tiklanadi
    online.value = true;
    const reopened = make();
    expect(reopened.pending).toHaveLength(1);
    await reopened.flush();
    expect(api.saveProgress).toHaveBeenCalledTimes(1);
    expect(reopened.pending).toEqual([]);
  });

  it("tarmoq xatosida eksponensial kechikish bilan qayta uriniladi", async () => {
    const saveProgress = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(new ApiError("server", 503))
      .mockResolvedValue({});
    const { make, timers } = setup({ saveProgress });
    const queue = make();
    queue.enqueue(progressItem("a"));
    await settle();
    expect(queue.pending).toHaveLength(1);
    expect(timers.map((timer) => timer.delay)).toEqual([1000]);

    timers.shift()?.callback();
    await settle();
    expect(timers.map((timer) => timer.delay)).toEqual([2000]);

    timers.shift()?.callback();
    await settle();
    expect(queue.pending).toEqual([]);
    expect(saveProgress).toHaveBeenCalledTimes(3);
  });

  it("doimiy xatoda (404) yozuvni tashlab, keyingisiga o'tadi", async () => {
    const saveProgress = vi
      .fn()
      .mockRejectedValueOnce(new ApiError("yoq", 404))
      .mockResolvedValue({});
    const { make } = setup({ saveProgress });
    const queue = make();
    queue.enqueue(progressItem("gone"));
    queue.enqueue(progressItem("b"));
    await queue.flush();
    expect(queue.pending).toEqual([]);
    expect(saveProgress).toHaveBeenCalledTimes(2);
  });

  it("yuborish paytida yangilangan yozuv navbatda qoladi", async () => {
    let release: () => void = () => {};
    const saveProgress = vi
      .fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => (release = resolve)))
      .mockResolvedValue({});
    const { make } = setup({ saveProgress });
    const queue = make();
    queue.enqueue(progressItem("a", "started"));
    queue.enqueue(progressItem("a", "completed"));
    release();
    await queue.flush();
    expect(saveProgress).toHaveBeenLastCalledWith({ topicId: "a", readStatus: "completed" });
    expect(queue.pending).toEqual([]);
  });

  it("mavzu ochilishini yuboradi va takror yuborishda dublikat qilmaydi", async () => {
    const { api, make, online } = setup();
    online.value = false;
    const queue = make();
    queue.enqueue({ kind: "opened", topicId: "a" });
    queue.enqueue({ kind: "opened", topicId: "a" });
    expect(queue.pending).toHaveLength(1);
    online.value = true;
    await queue.flush();
    expect(api.recordTopicOpened).toHaveBeenCalledTimes(1);
    expect(api.recordTopicOpened).toHaveBeenCalledWith("a");
  });

  it("server rad etgan yozuv navbatdan chiqadi va onDropped chaqiriladi (rollback)", async () => {
    const onDropped = vi.fn();
    const rejected = new ApiError("topilmadi", 404, { code: "not_found" });
    const { api, make } = setup(
      { saveProgress: vi.fn().mockRejectedValueOnce(rejected) },
      { value: true },
      { onDropped },
    );
    const queue = make();
    const item = progressItem("a");
    queue.enqueue(item);
    queue.enqueue({ kind: "bookmark", topicId: "b", bookmarked: true });
    await queue.flush();
    expect(onDropped).toHaveBeenCalledTimes(1);
    expect(onDropped).toHaveBeenCalledWith(item, rejected);
    // rad etilgani qayta urinilmaydi, keyingi yozuv esa yuboriladi
    expect(api.saveProgress).toHaveBeenCalledTimes(1);
    expect(api.setBookmark).toHaveBeenCalledWith("b", true);
    expect(queue.pending).toEqual([]);
  });

  it("vaqtinchalik xatoda onDropped chaqirilmaydi va yozuv qoladi", async () => {
    const onDropped = vi.fn();
    const { make, timers } = setup(
      { saveProgress: vi.fn().mockRejectedValue(new ApiError("server", 503)) },
      { value: true },
      { onDropped },
    );
    const queue = make();
    queue.enqueue(progressItem("a"));
    await queue.flush();
    expect(onDropped).not.toHaveBeenCalled();
    expect(queue.pending).toHaveLength(1);
    expect(timers).toHaveLength(1);
  });

  it("buzilgan saqlangan navbatni e'tiborsiz qoldiradi", () => {
    const { make, storage } = setup();
    storage.setItem("q", "{bad json");
    expect(make().pending).toEqual([]);
  });
});

describe("isPermanentError", () => {
  it("4xx doimiy, lekin 401/408/429 va 5xx/tarmoq emas", () => {
    expect(isPermanentError(new ApiError("x", 400))).toBe(true);
    expect(isPermanentError(new ApiError("x", 404))).toBe(true);
    expect(isPermanentError(new ApiError("x", 401))).toBe(false);
    expect(isPermanentError(new ApiError("x", 429))).toBe(false);
    expect(isPermanentError(new ApiError("x", 500))).toBe(false);
    expect(isPermanentError(new TypeError("network"))).toBe(false);
  });
});

describe("overlayProgress", () => {
  it("kutilayotgan yozuvlarni server ro'yxati ustiga qo'yadi", () => {
    const server = [{ topicId: "a", v: 1 }];
    const result = overlayProgress(
      server,
      [progressItem("a", "completed"), progressItem("b")],
      (input, existing) => ({ topicId: input.topicId, v: (existing?.v ?? 0) + 10 }),
    );
    expect(result).toEqual([
      { topicId: "a", v: 11 },
      { topicId: "b", v: 10 },
    ]);
  });
});
