import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/types";

vi.mock("./backend", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  startTelegramLogin: vi.fn(),
  telegramLoginStatus: vi.fn(),
  completeTelegramLogin: vi.fn(),
}));

import { completeTelegramLogin, startTelegramLogin, telegramLoginStatus } from "./backend";
import { authorizeTelegramBot, BackendSignInError } from "./social-providers";
import { handleTelegramStart, handleTelegramStatus, readCookie } from "./telegram-bot";

const TOKEN = "t".repeat(43);

const request = (path: string, init: RequestInit = {}) =>
  new Request(`http://localhost:3000${path}`, init);

beforeEach(() => {
  vi.mocked(startTelegramLogin).mockReset();
  vi.mocked(telegramLoginStatus).mockReset();
  vi.mocked(completeTelegramLogin).mockReset();
});

describe("readCookie", () => {
  it("nomi bo'yicha qiymatni oladi", () => {
    const headers = new Headers({ cookie: "a=1; tg_nonce=abc%3D; b=2" });
    expect(readCookie(headers, "tg_nonce")).toBe("abc=");
    expect(readCookie(headers, "missing")).toBe("");
    expect(readCookie(new Headers(), "tg_nonce")).toBe("");
  });
});

describe("handleTelegramStart", () => {
  it("nonce'ni httpOnly cookie'ga yozadi va javobdan olib tashlaydi", async () => {
    vi.mocked(startTelegramLogin).mockResolvedValue({
      token: TOKEN,
      bot_url: `https://t.me/bot?start=${TOKEN}`,
      expires_in: 300,
      nonce: "secret-nonce",
    });
    const response = await handleTelegramStart(
      request("/api/auth/telegram/start", {
        method: "POST",
        headers: { "sec-fetch-site": "same-origin" },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      token: TOKEN,
      bot_url: `https://t.me/bot?start=${TOKEN}`,
      expires_in: 300,
    });
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("tg_nonce=secret-nonce");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Max-Age=300");
    expect(cookie).toContain("Path=/api/auth");
  });

  it("boshqa saytdan kelgan so'rovni rad etadi (CSRF)", async () => {
    const response = await handleTelegramStart(
      request("/api/auth/telegram/start", {
        method: "POST",
        headers: { "sec-fetch-site": "cross-site" },
      }),
    );
    expect(response.status).toBe(403);
    expect(startTelegramLogin).not.toHaveBeenCalled();
  });

  it("backend xatosini kod bilan qaytaradi (429)", async () => {
    vi.mocked(startTelegramLogin).mockRejectedValue(
      new ApiError("Too many", 429, { code: "throttled" }),
    );
    const response = await handleTelegramStart(
      request("/api/auth/telegram/start", { method: "POST" }),
    );
    expect(response.status).toBe(429);
    expect((await response.json()).code).toBe("throttled");
  });
});

describe("handleTelegramStatus", () => {
  it("cookie'dagi nonce'ni backend'ga uzatadi", async () => {
    vi.mocked(telegramLoginStatus).mockResolvedValue({ status: "pending" });
    const response = await handleTelegramStatus(
      request(`/api/auth/telegram/status?token=${TOKEN}`, { headers: { cookie: "tg_nonce=n1" } }),
    );
    expect(await response.json()).toEqual({ status: "pending" });
    expect(vi.mocked(telegramLoginStatus).mock.calls[0]?.slice(0, 2)).toEqual([TOKEN, "n1"]);
  });

  it("nonce mos kelmasa 403 qaytadi", async () => {
    vi.mocked(telegramLoginStatus).mockRejectedValue(
      new ApiError("Other browser", 403, { code: "telegram_nonce_mismatch" }),
    );
    const response = await handleTelegramStatus(
      request(`/api/auth/telegram/status?token=${TOKEN}`),
    );
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("telegram_nonce_mismatch");
  });
});

describe("authorizeTelegramBot", () => {
  const session = {
    access: `x.${btoa(JSON.stringify({ exp: 2_000_000_000 }))}.y`,
    refresh: "refresh-token",
    is_new: true,
    profile_completed: false,
    user: {
      id: "u-1",
      email: null,
      email_verified: false,
      role: "student",
      date_joined: "2026-10-20T00:00:00Z",
      profile: {
        display_name: "Vali",
        avatar_url: "",
        locale: "uz",
        grade: null,
        subjects: [],
        grades: [],
        onboarded_at: null,
      },
    },
  } as unknown as Awaited<ReturnType<typeof completeTelegramLogin>>;

  it("token va cookie'dagi nonce bilan backend sessiyasini oladi", async () => {
    vi.mocked(completeTelegramLogin).mockResolvedValue(session);
    const user = await authorizeTelegramBot(
      { token: TOKEN, locale: "ru" },
      new Headers({ cookie: "tg_nonce=n1" }),
    );
    expect(vi.mocked(completeTelegramLogin).mock.calls[0]?.slice(0, 2)).toEqual([
      { token: TOKEN, locale: "ru" },
      "n1",
    ]);
    expect(user.id).toBe("u-1");
    expect(user.backend?.refresh).toBe("refresh-token");
  });

  it("yaroqsiz token backend'ga bormaydi", async () => {
    await expect(authorizeTelegramBot({ token: "../x" }, new Headers())).rejects.toBeInstanceOf(
      BackendSignInError,
    );
    expect(completeTelegramLogin).not.toHaveBeenCalled();
  });

  it("ikkinchi marta ishlatilgan token — telegram_login_expired", async () => {
    vi.mocked(completeTelegramLogin).mockRejectedValue(
      new ApiError("Expired", 410, { code: "telegram_login_expired" }),
    );
    await expect(
      authorizeTelegramBot({ token: TOKEN }, new Headers({ cookie: "tg_nonce=n1" })),
    ).rejects.toMatchObject({ code: "telegram_login_expired" });
  });
});
