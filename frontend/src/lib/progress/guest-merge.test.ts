import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/types";
import type { GuestData, GuestProgress, MergeResult } from "@/types/progress";
import { chunkGuestData, GuestMerger, type GuestMergeOptions } from "./guest-merge";

const progress = (patch: Partial<GuestProgress> = {}): GuestProgress => ({
  readStatus: "started",
  mistakes: [],
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...patch,
});

const GUEST: GuestData = { progress: { "algebra-9-viyet": progress() }, bookmarks: ["a-1"] };
const OK: MergeResult = { progress: 1, bookmarks: 1, failed: [] };

function setup(options: Partial<GuestMergeOptions> = {}, initial: GuestData = GUEST) {
  // Mehmon "store"i: muvaffaqiyatdan keyin onMerged uni tozalaydi (AuthProvider'dagidek).
  const store = { data: initial };
  const timers: Array<{ callback: () => void; delay: number }> = [];
  const delays: number[] = [];
  const mergeGuestData = vi.fn().mockResolvedValue(OK);
  const onMerged = vi.fn(() => {
    store.data = { progress: {}, bookmarks: [] };
  });
  const merger = new GuestMerger({
    api: { mergeGuestData },
    load: async () => store.data,
    onMerged,
    schedule: (callback, delay) => {
      delays.push(delay);
      // Ishga tushgan taymer ro'yxatdan chiqadi (haqiqiy taymerdagidek).
      const entry = {
        delay,
        callback: () => {
          timers.splice(timers.indexOf(entry), 1);
          callback();
        },
      };
      timers.push(entry);
      return entry;
    },
    cancel: (handle) => {
      const index = timers.indexOf(handle as (typeof timers)[number]);
      if (index !== -1) timers.splice(index, 1);
    },
    ...options,
  });
  return { merger, store, timers, delays, mergeGuestData, onMerged };
}

describe("GuestMerger", () => {
  it("muvaffaqiyatda serverga yuboradi va onMerged chaqiriladi", async () => {
    const { merger, mergeGuestData, onMerged, store } = setup();
    expect(await merger.start()).toBe("merged");
    expect(mergeGuestData).toHaveBeenCalledWith(GUEST);
    expect(onMerged).toHaveBeenCalledWith(OK);
    expect(store.data.bookmarks).toEqual([]);
  });

  it("mehmon ma'lumoti bo'lmasa so'rov yuborilmaydi", async () => {
    const { merger, mergeGuestData, onMerged } = setup({}, { progress: {}, bookmarks: [] });
    expect(await merger.start()).toBe("empty");
    expect(mergeGuestData).not.toHaveBeenCalled();
    expect(onMerged).not.toHaveBeenCalled();
  });

  it("xatoda ma'lumot saqlanib qoladi va qayta urinish rejalashtiriladi", async () => {
    const { merger, mergeGuestData, onMerged, store, timers } = setup();
    mergeGuestData.mockRejectedValueOnce(new ApiError("server", 503));
    expect(await merger.start()).toBe("failed");
    expect(onMerged).not.toHaveBeenCalled();
    expect(store.data).toEqual(GUEST);
    expect(timers).toHaveLength(1);
  });

  it("qayta urinish muvaffaqiyatli bo'lsa tozalanadi", async () => {
    const { merger, mergeGuestData, onMerged, store, timers } = setup();
    mergeGuestData.mockRejectedValueOnce(new ApiError("tarmoq", 0, { code: "network_error" }));
    await merger.start();
    timers[0].callback();
    await vi.waitFor(() => expect(onMerged).toHaveBeenCalledTimes(1));
    expect(mergeGuestData).toHaveBeenCalledTimes(2);
    expect(store.data.progress).toEqual({});
    expect(timers).toHaveLength(0);
  });

  it("kechikish eksponensial o'sadi va urinishlar soni cheklangan", async () => {
    const { merger, mergeGuestData, timers, delays } = setup({ baseDelayMs: 100, maxAttempts: 3 });
    mergeGuestData.mockRejectedValue(new ApiError("server", 500));
    await merger.start();
    timers[0].callback();
    await vi.waitFor(() => expect(delays).toHaveLength(2));
    timers[0].callback();
    await vi.waitFor(() => expect(mergeGuestData).toHaveBeenCalledTimes(3));
    await Promise.resolve();
    expect(delays).toEqual([100, 200]); // 3-urinishdan keyin yangi taymer yo'q
    expect(timers).toHaveLength(0);
  });

  it("doimiy rad etilsa (4xx) qayta urinmaydi, ma'lumot qoladi", async () => {
    const { merger, mergeGuestData, store, timers } = setup();
    mergeGuestData.mockRejectedValueOnce(
      new ApiError("noto'g'ri", 400, { code: "validation_error" }),
    );
    expect(await merger.start()).toBe("failed");
    expect(timers).toHaveLength(0);
    merger.retryNow();
    expect(mergeGuestData).toHaveBeenCalledTimes(1);
    expect(store.data).toEqual(GUEST);
  });

  it("oflayn bo'lsa so'rov yubormaydi; internet qaytganda retryNow yuboradi", async () => {
    const online = { value: false };
    const { merger, mergeGuestData, onMerged, timers } = setup({ isOnline: () => online.value });
    expect(await merger.start()).toBe("failed");
    expect(mergeGuestData).not.toHaveBeenCalled();
    expect(timers).toHaveLength(1);
    online.value = true;
    merger.retryNow();
    await vi.waitFor(() => expect(onMerged).toHaveBeenCalledTimes(1));
    expect(timers).toHaveLength(0);
  });

  it("muvaffaqiyatdan keyin takror ishga tushirilsa hech narsa yuborilmaydi (idempotent)", async () => {
    const { merger, mergeGuestData } = setup();
    await merger.start();
    expect(await merger.start()).toBe("empty");
    expect(mergeGuestData).toHaveBeenCalledTimes(1);
  });

  it("dispose'dan keyin qayta urinish va onMerged bo'lmaydi", async () => {
    const { merger, mergeGuestData, onMerged, timers } = setup();
    mergeGuestData.mockRejectedValueOnce(new ApiError("server", 503));
    await merger.start();
    merger.dispose();
    expect(timers).toHaveLength(0);
    merger.retryNow();
    expect(onMerged).not.toHaveBeenCalled();
  });

  it("katta ma'lumot server limitiga mos bo'laklarga bo'linadi va natija yig'iladi", async () => {
    const many: GuestData = {
      progress: Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`t-${i}`, progress()])),
      bookmarks: ["b1", "b2", "b3"],
    };
    const chunks = chunkGuestData(many, 2);
    expect(chunks).toHaveLength(3);
    expect(
      chunks.every((c) => Object.keys(c.progress).length <= 2 && c.bookmarks.length <= 2),
    ).toBe(true);
    expect(chunks.flatMap((c) => Object.keys(c.progress))).toHaveLength(5);
    expect(chunks.flatMap((c) => c.bookmarks)).toEqual(["b1", "b2", "b3"]);
  });
});
