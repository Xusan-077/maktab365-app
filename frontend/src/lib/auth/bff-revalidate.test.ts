import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cache = vi.hoisted(() => ({ revalidateTag: vi.fn() }));
vi.mock("next/cache", () => cache);
vi.mock("./server-token", () => ({
  readSessionToken: async () => null,
  effectiveTokens: () => null,
}));

import { proxyToBackend } from "./bff";

const BFF = "http://localhost:3000/api/backend";

function call(method: string, path: string, status: number) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(status === 204 ? null : "{}", { status })),
  );
  return proxyToBackend(
    new Request(`${BFF}${path}`, {
      method,
      headers: { "sec-fetch-site": "same-origin", "content-type": "application/json" },
      body: method === "GET" ? undefined : JSON.stringify({ status: "draft" }),
    }),
  );
}

beforeEach(() => cache.revalidateTag.mockClear());
afterEach(() => vi.unstubAllGlobals());

describe("BFF: kitob holati o'zgarsa ochiq kesh yangilanadi", () => {
  it("kitobni yashirish (PATCH status) `pdf-books` tegini darhol eskiradi", async () => {
    await call("PATCH", "/api/v1/admin/pdf-books/b1", 200);

    expect(cache.revalidateTag).toHaveBeenCalledWith("pdf-books", { expire: 0 });
  });

  it("nashr/yashirish o'tishi va o'chirish ham keshni eskiradi", async () => {
    await call("POST", "/api/v1/admin/pdf-books/b1/transition", 200);
    await call("DELETE", "/api/v1/admin/pdf-books/b1", 204);

    expect(cache.revalidateTag).toHaveBeenCalledTimes(2);
  });

  it("rad etilgan yozuv va o'qish so'rovi keshga tegmaydi", async () => {
    await call("PATCH", "/api/v1/admin/pdf-books/b1", 403);
    await call("GET", "/api/v1/admin/pdf-books/b1", 200);

    expect(cache.revalidateTag).not.toHaveBeenCalled();
  });
});
