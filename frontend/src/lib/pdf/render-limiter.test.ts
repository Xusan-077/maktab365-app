import { describe, expect, it } from "vitest";
import { RenderLimiter } from "./render-limiter";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("RenderLimiter", () => {
  it("bir vaqtda `concurrency` ta; qolgani ustuvorlik bo'yicha (joriy bet birinchi)", async () => {
    const limiter = new RenderLimiter(2);
    const started: string[] = [];
    const take = (name: string, priority: number) => {
      const slot = limiter.acquire(priority);
      void slot.ready.then(() => started.push(name));
      return slot;
    };
    const a = take("a", 1);
    take("b", 1);
    take("c", 1);
    take("current", 0);
    await flush();
    expect(started).toEqual(["a", "b"]);
    a.release();
    await flush();
    expect(started).toEqual(["a", "b", "current"]);
  });

  it("bekor qilingan (eskirgan zoom) so'rov navbatdan olinadi va hech qachon boshlanmaydi", async () => {
    const limiter = new RenderLimiter(1);
    const started: string[] = [];
    const first = limiter.acquire(0);
    void first.ready.then(() => started.push("first"));
    const stale = limiter.acquire(0);
    void stale.ready.then(() => started.push("stale"));
    const fresh = limiter.acquire(0);
    void fresh.ready.then(() => started.push("fresh"));
    stale.release();
    expect(limiter.pending).toBe(1);
    first.release();
    first.release(); // takror — xavfsiz
    await flush();
    expect(started).toEqual(["first", "fresh"]);
  });
});
