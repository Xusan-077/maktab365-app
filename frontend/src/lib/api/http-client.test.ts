import { describe, expect, it, vi } from "vitest";
import { HttpApi } from "./http-api";
import { createHttpClient, REQUEST_ID_HEADER } from "./http-client";
import { ApiError } from "./types";

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

function apiWith(fetchImpl: typeof fetch, timeoutMs?: number) {
  return new HttpApi(createHttpClient({ baseUrl: "http://api.test", fetch: fetchImpl, timeoutMs }));
}

describe("HttpApi.health", () => {
  it("ok javobni qaytaradi va so'rov id yuboradi", async () => {
    const fetchMock = vi.fn(async (request: Request) => {
      expect(request.url).toBe("http://api.test/api/v1/health/");
      expect(request.headers.get(REQUEST_ID_HEADER)).toMatch(/^[a-f0-9]{32}$/);
      return json({ status: "ok", checks: { database: "ok", redis: "ok" } });
    });
    const health = await apiWith(fetchMock as unknown as typeof fetch).health();
    expect(health.status).toBe("ok");
  });

  it("503 da 'degraded' holatni xato emas, ma'lumot sifatida qaytaradi", async () => {
    const body = { status: "degraded", checks: { database: "ok", redis: "error" } };
    const api = apiWith((async () => json(body, { status: 503 })) as typeof fetch);
    expect(await api.health()).toEqual(body);
  });
});

describe("xatolar", () => {
  it("{code,message,details} ni ApiError ga aylantiradi", async () => {
    const api = apiWith((async () =>
      json(
        { code: "validation_error", message: "bad", details: { name: ["required"] } },
        { status: 400, headers: { [REQUEST_ID_HEADER]: "req-12345678" } },
      )) as typeof fetch);
    const error = await api.health().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      code: "validation_error",
      details: { name: ["required"] },
      requestId: "req-12345678",
    });
  });

  it("noma'lum javob shaklini unexpected_response deb belgilaydi", async () => {
    const api = apiWith((async () => new Response("oops", { status: 502 })) as typeof fetch);
    await expect(api.health()).rejects.toMatchObject({
      status: 502,
      code: "unexpected_response",
    });
  });

  it("tarmoq xatosi network_error", async () => {
    const api = apiWith((async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch);
    await expect(api.health()).rejects.toMatchObject({ status: 0, code: "network_error" });
  });

  it("timeout dan keyin timeout xatosi", async () => {
    const hang = ((request: Request) =>
      new Promise((_, reject) => {
        request.signal.addEventListener("abort", () => reject(new DOMException("a", "AbortError")));
      })) as unknown as typeof fetch;
    await expect(apiWith(hang, 20).health()).rejects.toMatchObject({ code: "timeout" });
  });
});

describe("qolgan metodlar", () => {
  it("keyingi bosqichda xatosi (501)", async () => {
    const api = apiWith(fetch);
    await expect(api.getGrades()).rejects.toMatchObject({ status: 501, code: "not_implemented" });
  });
});
