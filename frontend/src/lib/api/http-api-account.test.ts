import { describe, expect, it, vi } from "vitest";
import { HttpApi } from "./http-api";
import { createHttpClient } from "./http-client";
import { ApiError } from "./types";

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

const meBody = (role: string, profile: Record<string, unknown> = {}) => ({
  id: "11111111-1111-1111-1111-111111111111",
  email: "ali@example.com",
  email_verified: false,
  role,
  date_joined: "2026-10-19T00:00:00Z",
  profile: {
    display_name: "Ali",
    avatar_url: "",
    locale: "uz",
    grade: null,
    subjects: [],
    grades: [],
    onboarded_at: "2026-10-19T00:00:00Z",
    ...profile,
  },
});

function setup(respond: (request: Request) => Response | Promise<Response>) {
  // Klient `fetch(url, init)` chaqiradi; testlar uchun `Request` qilib yig'iladi.
  const fetchMock = vi.fn(async (request: Request) => respond(request));
  const fetchImpl = (input: RequestInfo | URL, init?: RequestInit) =>
    fetchMock(new Request(input, init));
  const api = new HttpApi(
    createHttpClient({ baseUrl: "http://api.test", fetch: fetchImpl as typeof fetch }),
  );
  return { api, fetchMock };
}

describe("HttpApi: profil", () => {
  it("getMe o'quvchini User ga aylantiradi", async () => {
    const { api } = setup(() => json(meBody("student", { grade: 5 })));
    expect(await api.getMe()).toEqual({
      id: "11111111-1111-1111-1111-111111111111",
      role: "student",
      name: "Ali",
      grade: 5,
    });
  });

  it("getMe o'qituvchi uchun fan va sinflarni qaytaradi", async () => {
    const { api } = setup(() =>
      json(meBody("teacher", { subjects: ["math"], grades: [5, 6], display_name: "Vali" })),
    );
    expect(await api.getMe()).toMatchObject({
      role: "teacher",
      name: "Vali",
      subjects: ["math"],
      grades: [5, 6],
    });
  });

  it("getMe: onboarding tugamagan yoki kirmagan bo'lsa null", async () => {
    const pending = setup(() => json(meBody("student", { onboarded_at: null })));
    expect(await pending.api.getMe()).toBeNull();
    const anonymous = setup(() =>
      json({ code: "not_authenticated", message: "x" }, { status: 401 }),
    );
    expect(await anonymous.api.getMe()).toBeNull();
  });

  it("saveProfile onboarding'ga snake_case tana yuboradi", async () => {
    const { api, fetchMock } = setup(() => json(meBody("teacher", { subjects: ["math"] })));
    await api.saveProfile({ role: "teacher", name: " Vali ", subjects: ["math"], grades: [5] });
    const request = fetchMock.mock.calls[0]![0];
    expect(request.method).toBe("POST");
    expect(new URL(request.url).pathname).toBe("/api/v1/me/onboarding/");
    expect(await request.clone().json()).toEqual({
      role: "teacher",
      display_name: "Vali",
      subjects: ["math"],
      grades: [5],
    });
  });

  it("updateProfile faqat berilgan maydonlarni PATCH qiladi", async () => {
    const { api, fetchMock } = setup(() => json(meBody("student", { grade: 7 })));
    await api.updateProfile({ grade: 7 });
    const request = fetchMock.mock.calls[0]![0];
    expect(request.method).toBe("PATCH");
    expect(await request.clone().json()).toEqual({ grade: 7 });
  });

  it("setRole rol endpoint'iga yuboradi; 403 ApiError bo'ladi", async () => {
    const ok = setup(() => json(meBody("teacher")));
    expect(await ok.api.setRole("teacher")).toMatchObject({ role: "teacher" });
    expect(new URL(ok.fetchMock.mock.calls[0]![0].url).pathname).toBe("/api/v1/me/role/");

    const denied = setup(() => json({ code: "role_forbidden", message: "x" }, { status: 403 }));
    await expect(denied.api.setRole("teacher")).rejects.toMatchObject({
      status: 403,
      code: "role_forbidden",
    });
  });

  it("deleteAccount 204 da tugaydi, xatoda ApiError", async () => {
    const ok = setup(() => new Response(null, { status: 204 }));
    await expect(ok.api.deleteAccount()).resolves.toBeUndefined();
    expect(ok.fetchMock.mock.calls[0]![0].method).toBe("DELETE");

    const failed = setup(() => json({ code: "server_error", message: "x" }, { status: 500 }));
    await expect(failed.api.deleteAccount()).rejects.toBeInstanceOf(ApiError);
  });

  it("exportData javobni o'zgartirmay qaytaradi", async () => {
    const body = { exported_at: "2026-10-19T00:00:00Z", identities: [], auth_events: [] };
    const { api } = setup(() => json(body));
    expect(await api.exportData()).toEqual(body);
  });
});

describe("HttpApi: yordam murojaatlari", () => {
  it("sendSupport snake_case tana bilan POST qiladi (mehmon ham)", async () => {
    const { api, fetchMock } = setup(() => json({ ok: true }, { status: 201 }));
    await api.sendSupport({
      kind: "content_error",
      message: "Formulada xato bor",
      email: "ali@example.com",
      topic: "algebra-1",
      pageUrl: "https://x.uz/uz/a",
    });
    const request = fetchMock.mock.calls[0]![0];
    expect(request.method).toBe("POST");
    expect(new URL(request.url).pathname).toBe("/api/v1/support/");
    expect(await request.json()).toEqual({
      kind: "content_error",
      message: "Formulada xato bor",
      email: "ali@example.com",
      name: "",
      topic: "algebra-1",
      website: "",
      page_url: "https://x.uz/uz/a",
    });
  });

  it("sendSupport throttle xatosini ApiError qilib ko'taradi", async () => {
    const { api } = setup(() => json({ code: "throttled", message: "Too many" }, { status: 429 }));
    await expect(
      api.sendSupport({ kind: "bug", message: "Uzun xabar matni" }),
    ).rejects.toMatchObject({ status: 429, code: "throttled" });
  });

  it("getMySupport sahifadan murojaatlarni oladi va camelCase ga aylantiradi", async () => {
    const { api } = setup(() =>
      json({
        count: 1,
        next: null,
        previous: null,
        results: [
          {
            id: "22222222-2222-2222-2222-222222222222",
            kind: "bug",
            message: "Rasm ochilmayapti",
            topic: "",
            page_url: "",
            status: "in_progress",
            created_at: "2026-10-20T10:00:00Z",
          },
        ],
      }),
    );
    expect(await api.getMySupport()).toEqual([
      {
        id: "22222222-2222-2222-2222-222222222222",
        kind: "bug",
        message: "Rasm ochilmayapti",
        topic: "",
        pageUrl: "",
        status: "in_progress",
        createdAt: "2026-10-20T10:00:00Z",
      },
    ]);
  });
});
