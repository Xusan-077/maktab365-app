import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/types";
import { opKey, isRetriable, WriteQueue, type WriteOp } from "./write-queue";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

const progress = (page: number, bookId = "b1"): WriteOp => ({
  kind: "progress",
  bookId,
  page,
  at: `2026-01-01T10:00:0${page}Z`,
});
const offline = () => new ApiError("offline", 0, { code: "network_error" });
const rejected = (status = 404) => new ApiError("rad", status, { code: "not_found" });

function make(send: (op: WriteOp) => Promise<unknown>, storage = memoryStorage(), userId = "u1") {
  const onSent = vi.fn();
  return { queue: new WriteQueue({ userId, send, storage, onSent }), storage, onSent };
}

describe("isRetriable", () => {
  it("tarmoq, timeout, 408/429 va 5xx qayta uriniladi; boshqa 4xx — yo'q", () => {
    expect(isRetriable(offline())).toBe(true);
    expect(isRetriable(new TypeError("fetch failed"))).toBe(true);
    for (const status of [408, 429, 500, 503]) expect(isRetriable(rejected(status))).toBe(true);
    for (const status of [400, 401, 403, 404, 409])
      expect(isRetriable(rejected(status))).toBe(false);
  });
});

describe("WriteQueue", () => {
  it("online: amal darhol yuboriladi va navbat bo'sh qoladi", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const { queue, storage, onSent } = make(send);

    expect(await queue.run(progress(3))).toBe("sent");

    expect(send).toHaveBeenCalledTimes(1);
    expect(queue.size).toBe(0);
    expect(storage.data.size).toBe(0);
    expect(onSent).toHaveBeenCalledWith(progress(3));
  });

  it("offline: amal saqlanadi (brauzer xotirasida) va 'queued' qaytadi", async () => {
    const { queue, storage } = make(vi.fn().mockRejectedValue(offline()));

    expect(await queue.run(progress(3))).toBe("queued");

    expect(queue.size).toBe(1);
    expect(JSON.parse(storage.data.get("maktab365-writes:u1")!)).toEqual([progress(3)]);
  });

  it("qayta urinish: internet qaytgach flush navbatni yuboradi", async () => {
    const send = vi.fn().mockRejectedValueOnce(offline()).mockResolvedValue(undefined);
    const { queue, storage } = make(send);
    await queue.run(progress(3));

    await queue.flush();

    expect(send).toHaveBeenCalledTimes(2);
    expect(queue.size).toBe(0);
    expect(storage.data.size).toBe(0);
  });

  it("sahifa yangilangandan keyin ham: navbat xotiradan tiklanadi", async () => {
    const storage = memoryStorage();
    await make(vi.fn().mockRejectedValue(offline()), storage).queue.run(progress(5));

    const send = vi.fn().mockResolvedValue(undefined);
    const { queue } = make(send, storage);
    expect(queue.pending()).toEqual([progress(5)]);

    await queue.flush();
    expect(send).toHaveBeenCalledWith(progress(5));
    expect(queue.size).toBe(0);
  });

  it("bir kalitli amallar birlashadi: oxirgisi yutadi", async () => {
    const send = vi.fn().mockRejectedValue(offline());
    const { queue } = make(send);

    await queue.run(progress(3));
    await queue.run(progress(7));
    await queue.run({ kind: "bookmark", bookId: "b1", saved: true });
    await queue.run({ kind: "bookmark", bookId: "b1", saved: false });

    expect(queue.pending()).toEqual([
      progress(7),
      { kind: "bookmark", bookId: "b1", saved: false },
    ]);
  });

  it("vaqtincha xatoda tartib saqlanadi va keyingilar urinilmaydi", async () => {
    let online = false;
    const sent: string[] = [];
    const send = vi.fn(async (op: WriteOp) => {
      if (!online) throw offline();
      sent.push(opKey(op));
    });
    const { queue } = make(send);

    await queue.run(progress(2, "a"));
    await queue.run(progress(2, "b"));
    expect(queue.size).toBe(2);
    expect(send).toHaveBeenCalledTimes(2); // ikkala run ham faqat "a" ni urindi, "b" ga o'tmadi

    online = true;
    await queue.flush();
    expect(sent).toEqual(["progress:a", "progress:b"]);
    expect(queue.size).toBe(0);
  });

  it("doimiy rad etish (4xx): amal navbatdan olinadi va xato chaqiruvchiga qaytadi", async () => {
    const error = rejected(404);
    const { queue, storage } = make(vi.fn().mockRejectedValue(error));

    await expect(queue.run(progress(3))).rejects.toBe(error);

    expect(queue.size).toBe(0);
    expect(storage.data.size).toBe(0);
  });

  it("navbatdagi rad etilgan amal boshqalarni to'smaydi", async () => {
    let online = false;
    const sent: string[] = [];
    const send = vi.fn(async (op: WriteOp) => {
      if (!online) throw offline();
      if (op.bookId === "bad") throw rejected(404);
      sent.push(opKey(op));
    });
    const { queue } = make(send);
    await queue.run(progress(1, "bad"));
    await queue.run(progress(1, "good"));
    expect(queue.size).toBe(2);

    online = true;
    await queue.flush();

    expect(sent).toEqual(["progress:good"]);
    expect(queue.size).toBe(0);
  });

  it("navbat foydalanuvchiga bog'liq: boshqa akkaunt yozuvlari yuborilmaydi", async () => {
    const storage = memoryStorage();
    await make(vi.fn().mockRejectedValue(offline()), storage, "u1").queue.run(progress(4));

    const send = vi.fn().mockResolvedValue(undefined);
    const other = make(send, storage, "u2").queue;
    await other.flush();

    expect(other.size).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("buzilgan xotira bo'sh navbat sifatida o'qiladi", () => {
    const storage = memoryStorage();
    storage.data.set("maktab365-writes:u1", "{not json");

    expect(make(vi.fn(), storage).queue.size).toBe(0);
  });
});
