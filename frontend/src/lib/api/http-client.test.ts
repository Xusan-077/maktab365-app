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
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
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

  it("GET tarmoq uzilishida qayta uriniladi, keyin muvaffaqiyat", async () => {
    let calls = 0;
    const api = apiWith((async () => {
      calls += 1;
      if (calls < 3) throw new TypeError("fetch failed");
      return json({ status: "ok", checks: { database: "ok", redis: "ok" } });
    }) as typeof fetch);
    expect((await api.health()).status).toBe("ok");
    expect(calls).toBe(3);
  });

  it("POST tarmoq uzilishida qayta urinilmaydi", async () => {
    let calls = 0;
    const client = createHttpClient({
      baseUrl: "http://api.test",
      fetch: (async () => {
        calls += 1;
        throw new TypeError("fetch failed");
      }) as typeof fetch,
    });
    await expect(
      client.POST("/api/v1/auth/password/forgot/", { body: { email: "a@b.uz" } }),
    ).rejects.toMatchObject({ code: "network_error" });
    expect(calls).toBe(1);
  });

  it("timeout dan keyin timeout xatosi", async () => {
    const hang = ((_input: string, init: RequestInit) =>
      new Promise((_, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("a", "AbortError")));
      })) as unknown as typeof fetch;
    await expect(apiWith(hang, 20).health()).rejects.toMatchObject({ code: "timeout" });
  });
});

describe("so'rov tanasi va token", () => {
  it("POST tanasini va server tokenini uzatadi", async () => {
    let seen: { body: string; auth: string | null } | undefined;
    const client = createHttpClient({
      baseUrl: "http://api.test",
      getAccessToken: async () => "tok",
      fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        seen = { body: await request.text(), auth: request.headers.get("Authorization") };
        return json({ ok: true });
      }) as typeof fetch,
    });
    await client.POST("/api/v1/auth/password/forgot/", { body: { email: "a@b.uz" } });
    expect(seen).toEqual({ body: JSON.stringify({ email: "a@b.uz" }), auth: "Bearer tok" });
  });
});
