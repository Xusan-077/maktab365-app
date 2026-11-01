import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/types";
import {
  AnnotationSaveQueue,
  ANNOTATION_QUEUE_PREFIX,
  type AnnotationOp,
  type AnnotationQueueState,
} from "./annotation-queue";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

const offline = () => new ApiError("offline", 0, { code: "network_error" });
const tooLarge = () =>
  new ApiError("bad", 400, {
    code: "validation_error",
    details: { annotations: ["page_too_large"] },
  });

const annotations = (page: number, count = 1): AnnotationOp => ({
  kind: "annotations",
  bookId: "book",
  page,
  items: Array.from({ length: count }, (_, i) => ({ id: `${page}-${i}`, type: "text", data: {} })),
  at: "2026-10-31T10:00:00Z",
});

function makeQueue(send: (op: AnnotationOp) => Promise<unknown>, storage = memoryStorage()) {
  const states: AnnotationQueueState[] = [];
  const queue = new AnnotationSaveQueue({
    userId: "u1",
    send,
    storage,
    onChange: (state) => states.push(state),
  });
  return { queue, storage, states };
}

describe("AnnotationSaveQueue", () => {
  it("enqueue darhol localStorage'ga yozadi (flush'dan oldin)", () => {
    const { queue, storage } = makeQueue(() => Promise.resolve());
    queue.enqueue(annotations(3));
    expect(JSON.parse(storage.data.get(`${ANNOTATION_QUEUE_PREFIX}u1`) ?? "[]")).toHaveLength(1);
    expect(queue.size).toBe(1);
  });

  it("bir bet uchun faqat oxirgi holat qoladi, boshqa bet va tur alohida", () => {
    const { queue } = makeQueue(() => Promise.resolve());
    queue.enqueue(annotations(3, 1));
    queue.enqueue(annotations(3, 4));
    queue.enqueue(annotations(4));
    expect(queue.size).toBe(2);
    expect(queue.find("annotations", "book", 3)?.items).toHaveLength(4);
  });

  it("flush amallarni tartib bilan yuboradi va navbatni tozalaydi", async () => {
    const sent: string[] = [];
    const { queue, storage } = makeQueue((op) => {
      sent.push(`${op.kind}:${op.page}`);
      return Promise.resolve();
    });
    queue.enqueue(annotations(1));
    queue.enqueue(annotations(2));
    await expect(queue.flush()).resolves.toBe("done");
    expect(sent).toEqual(["annotations:1", "annotations:2"]);
    expect(queue.size).toBe(0);
    expect(storage.data.size).toBe(0);
  });

  it("tarmoq xatosida navbatda qoladi va keyingi flush qayta yuboradi", async () => {
    let online = false;
    const send = vi.fn(() => (online ? Promise.resolve() : Promise.reject(offline())));
    const { queue, states } = makeQueue(send);
    queue.enqueue(annotations(5));

    await expect(queue.flush()).resolves.toBe("retry");
    expect(queue.size).toBe(1);
    expect(states.at(-1)?.failure).toBe("retry");

    online = true;
    await expect(queue.flush()).resolves.toBe("done");
    expect(queue.size).toBe(0);
    expect(states.at(-1)?.failure).toBeNull();
  });

  it("vaqtincha xatoda keyingi amallarni urib ko'rmaydi", async () => {
    const send = vi.fn(() => Promise.reject(offline()));
    const { queue } = makeQueue(send);
    queue.enqueue(annotations(1));
    queue.enqueue(annotations(2));
    await queue.flush();
    expect(send).toHaveBeenCalledTimes(1);
    expect(queue.size).toBe(2);
  });

  it("doimiy rad (4xx) amalni tashlaydi va xato kodini ko'rsatadi", async () => {
    const sent: number[] = [];
    const { queue, states } = makeQueue((op) => {
      if (op.page === 1) return Promise.reject(tooLarge());
      sent.push(op.page);
      return Promise.resolve();
    });
    queue.enqueue(annotations(1));
    queue.enqueue(annotations(2));
    await expect(queue.flush()).resolves.toBe("rejected");
    expect(queue.size).toBe(0);
    expect(sent).toEqual([2]); // rad etilgani keyingilarni to'xtatmaydi
    expect(states.at(-1)).toMatchObject({ failure: "rejected", code: "page_too_large" });
  });

  it("yuborish paytida yangilangan bet navbatda qoladi (yangi holat yo'qolmaydi)", async () => {
    let release!: () => void;
    const first = new Promise<void>((resolve) => (release = resolve));
    const send = vi.fn((op: AnnotationOp) =>
      op.page === 1 && send.mock.calls.length === 1 ? first : Promise.resolve(),
    );
    const { queue } = makeQueue(send);
    queue.enqueue(annotations(1, 1));
    const flushing = queue.flush();
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    queue.enqueue(annotations(1, 3)); // birinchi yuborish tugamasdan yangi holat tushdi
    release();
    await flushing;
    expect(queue.find("annotations", "book", 1)?.items).toHaveLength(3);
    await queue.flush();
    expect(queue.size).toBe(0);
  });

  it("sahifa qayta ochilganda saqlangan navbat tiklanadi", () => {
    const storage = memoryStorage();
    makeQueue(() => Promise.resolve(), storage).queue.enqueue(annotations(7, 2));
    const { queue } = makeQueue(() => Promise.resolve(), storage);
    expect(queue.size).toBe(1);
    expect(queue.find("annotations", "book", 7)?.items).toHaveLength(2);
  });

  it("eski versiyadagi yon daftar (`note`) amallari tashlanadi", () => {
    const storage = memoryStorage();
    storage.setItem(
      `${ANNOTATION_QUEUE_PREFIX}u1`,
      JSON.stringify([{ kind: "note", bookId: "book", page: 1, text: "x" }, annotations(2)]),
    );
    const { queue } = makeQueue(() => Promise.resolve(), storage);
    expect(queue.size).toBe(1);
    expect(queue.find("annotations", "book", 2)).toBeDefined();
  });

  it("buzilgan saqlangan ma'lumot navbatni buzmaydi", () => {
    const storage = memoryStorage();
    storage.setItem(`${ANNOTATION_QUEUE_PREFIX}u1`, "{not json");
    expect(makeQueue(() => Promise.resolve(), storage).queue.size).toBe(0);
  });

  it("bo'sh navbatda flush 'idle' beradi", async () => {
    const { queue } = makeQueue(() => Promise.resolve());
    await expect(queue.flush()).resolves.toBe("idle");
  });
});

describe("AnnotationSaveQueue: IndexedDB (durable) ombori", () => {
  function durableStore(initial: AnnotationOp[] | undefined) {
    const saved: AnnotationOp[][] = [];
    return {
      saved,
      load: vi.fn(async () => initial),
      save: vi.fn(async (_key: string, ops: AnnotationOp[]) => void saved.push(ops)),
    };
  }

  it("saqlangan navbatni o'qiydi; shu sessiyadagi yangi amal ustun", async () => {
    const durable = durableStore([annotations(1), annotations(2, 1)]);
    const queue = new AnnotationSaveQueue({
      userId: "u",
      send: vi.fn(),
      storage: memoryStorage(),
      durable,
    });
    queue.enqueue(annotations(2, 3));
    await queue.ready;
    expect(queue.size).toBe(2);
    expect(queue.find("annotations", "book", 2)?.items).toHaveLength(3);
    expect(queue.find("annotations", "book", 1)).toBeDefined();
  });

  it("internet qaytganda yuboriladi va ombor bo'shatiladi; localStorage nusxasi ko'chiriladi", async () => {
    const storage = memoryStorage();
    storage.setItem(`${ANNOTATION_QUEUE_PREFIX}u`, JSON.stringify([annotations(5)]));
    const durable = durableStore(undefined);
    const send = vi.fn().mockRejectedValueOnce(offline()).mockResolvedValue({});
    const queue = new AnnotationSaveQueue({ userId: "u", send, storage, durable });
    expect(await queue.flush()).toBe("retry");
    expect(queue.size).toBe(1);
    expect(await queue.flush()).toBe("done");
    expect(queue.size).toBe(0);
    await vi.waitFor(() => expect(durable.saved.at(-1)).toEqual([]));
    expect(storage.data.size).toBe(0);
  });

  it("IndexedDB yozolmasa localStorage'ga yozadi", async () => {
    const storage = memoryStorage();
    const durable = {
      load: vi.fn(async () => undefined),
      save: vi.fn(async () => {
        throw new Error("quota");
      }),
    };
    const queue = new AnnotationSaveQueue({ userId: "u", send: vi.fn(), storage, durable });
    await queue.ready;
    queue.enqueue(annotations(7));
    await vi.waitFor(() => expect(storage.data.get(`${ANNOTATION_QUEUE_PREFIX}u`)).toBeDefined());
  });
});
