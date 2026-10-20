import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "next-auth";
import type { components } from "@/lib/api/schema";
import { ApiError } from "@/lib/api/types";

vi.mock("./backend", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  loginWithTelegram: vi.fn(),
  loginWithOtp: vi.fn(),
  loginWithGoogle: vi.fn(),
}));

import { loginWithGoogle, loginWithOtp, loginWithTelegram } from "./backend";
import {
  authorizeOtp,
  authorizeTelegram,
  BackendSignInError,
  googleSignIn,
  telegramBody,
  type GoogleSignInDeps,
} from "./social-providers";

type AuthSession = components["schemas"]["AuthSession"];

const access = `x.${btoa(JSON.stringify({ exp: 2_000_000_000 }))}.y`;

const session = (overrides: Partial<AuthSession["user"]> = {}): AuthSession => ({
  access,
  refresh: "refresh-token",
  is_new: true,
  user: {
    id: "u-1",
    email: "ali@example.com",
    email_verified: true,
    role: "student",
    date_joined: "2026-10-20T00:00:00Z",
    profile: {
      display_name: "Ali",
      avatar_url: "",
      locale: "uz",
      grade: null,
      subjects: [],
      grades: [],
      onboarded_at: null,
    },
    ...overrides,
  },
});

const headers = new Headers({ "x-forwarded-for": "203.0.113.5", "user-agent": "UA" });
const apiError = (status: number, code: string) => new ApiError(code, status, { code });

const failedWith = async (promise: Promise<unknown>) => {
  const error = await promise.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(BackendSignInError);
  return (error as BackendSignInError).code;
};

beforeEach(() => vi.resetAllMocks());

describe("telegramBody", () => {
  it("id va auth_date son, bo'sh ixtiyoriy maydonlar tashlanadi, locale faqat yaroqli bo'lsa", () => {
    expect(
      telegramBody({
        id: "777",
        first_name: "Vali",
        last_name: "",
        username: "vali_k",
        auth_date: "1760000000",
        hash: "h".repeat(64),
        locale: "ru",
      }),
    ).toEqual({
      id: 777,
      first_name: "Vali",
      username: "vali_k",
      auth_date: 1760000000,
      hash: "h".repeat(64),
      locale: "ru",
    });
    expect(telegramBody({ id: "1", locale: "xx" })).not.toHaveProperty("locale");
  });
});

describe("authorizeTelegram", () => {
  const credentials = { id: "777", first_name: "Vali", auth_date: "1760000000", hash: "h" };

  it("backend sessiyasidan Auth.js foydalanuvchisini quradi va mijoz IP'sini uzatadi", async () => {
    vi.mocked(loginWithTelegram).mockResolvedValue(session({ email: null }));
    const user = await authorizeTelegram(credentials, headers);
    expect(user).toMatchObject({
      id: "u-1",
      backend: { access, refresh: "refresh-token" },
      account: { role: "student", onboarded: false, emailVerified: true },
    });
    expect(loginWithTelegram).toHaveBeenCalledWith(
      { id: 777, first_name: "Vali", auth_date: 1760000000, hash: "h" },
      { ip: "203.0.113.5", userAgent: "UA" },
    );
  });

  it("noto'g'ri/eski imzo: backend kodi klientga o'tadi", async () => {
    vi.mocked(loginWithTelegram).mockRejectedValue(apiError(401, "provider_auth_invalid"));
    expect(await failedWith(authorizeTelegram(credentials, headers))).toBe("provider_auth_invalid");
    vi.mocked(loginWithTelegram).mockRejectedValue(apiError(401, "provider_auth_expired"));
    expect(await failedWith(authorizeTelegram(credentials, headers))).toBe("provider_auth_expired");
  });

  it("maydonlar yaroqsiz bo'lsa backend'ga so'rov yuborilmaydi", async () => {
    expect(await failedWith(authorizeTelegram({ id: "abc", hash: "h" }, headers))).toBe(
      "provider_auth_invalid",
    );
    expect(await failedWith(authorizeTelegram({ ...credentials, hash: "" }, headers))).toBe(
      "provider_auth_invalid",
    );
    expect(loginWithTelegram).not.toHaveBeenCalled();
  });
});

describe("authorizeOtp", () => {
  it("kod bilan kiradi", async () => {
    vi.mocked(loginWithOtp).mockResolvedValue(session({ email: "ali@example.com" }));
    const user = await authorizeOtp(
      { email: " ali@example.com ", code: "123456", locale: "en" },
      headers,
    );
    expect(user.email).toBe("ali@example.com");
    expect(loginWithOtp).toHaveBeenCalledWith(
      { email: "ali@example.com", code: "123456", locale: "en" },
      { ip: "203.0.113.5", userAgent: "UA" },
    );
  });

  it("6 xonali emas kod backend'ga bormaydi", async () => {
    for (const code of ["12345", "1234567", "abcdef", ""]) {
      expect(await failedWith(authorizeOtp({ email: "a@b.uz", code }, headers))).toBe(
        "invalid_code",
      );
    }
    expect(loginWithOtp).not.toHaveBeenCalled();
  });

  it("backend xato kodlari: noto'g'ri, muddati o'tgan, bloklangan", async () => {
    for (const code of ["invalid_code", "code_expired", "otp_locked"]) {
      vi.mocked(loginWithOtp).mockRejectedValue(apiError(code === "otp_locked" ? 429 : 400, code));
      expect(await failedWith(authorizeOtp({ email: "a@b.uz", code: "123456" }, headers))).toBe(
        code,
      );
    }
  });
});

describe("googleSignIn", () => {
  const deps = (): GoogleSignInDeps => ({
    login: loginWithGoogle,
    info: () => ({ ip: "203.0.113.5", userAgent: "UA" }),
    locale: () => "ru",
  });
  const google = { provider: "google", id_token: "google.id.token" };

  it("id_token backend'ga almashtiriladi, backend sessiyasi user'ga yoziladi", async () => {
    vi.mocked(loginWithGoogle).mockResolvedValue(session({ email: "ali@gmail.com" }));
    const user = { id: "google-sub", name: "Google Name" } as User;
    expect(await googleSignIn({ user, account: google }, deps())).toBe(true);
    expect(loginWithGoogle).toHaveBeenCalledWith(
      { id_token: "google.id.token", locale: "ru" },
      { ip: "203.0.113.5", userAgent: "UA" },
    );
    // Google'ning o'z ma'lumoti emas, backend akkaunti ishlatiladi.
    expect(user).toMatchObject({
      id: "u-1",
      name: "Ali",
      email: "ali@gmail.com",
      backend: { refresh: "refresh-token" },
      account: { onboarded: false },
    });
  });

  it("boshqa provayderlarga tegmaydi", async () => {
    const user = {} as User;
    expect(await googleSignIn({ user, account: { provider: "github" } }, deps())).toBe(true);
    expect(loginWithGoogle).not.toHaveBeenCalled();
  });

  it("id_token yo'q → kirish sahifasiga xato kodi bilan", async () => {
    const result = await googleSignIn(
      { user: {} as User, account: { provider: "google" } },
      deps(),
    );
    expect(result).toBe("/kirish?authError=provider_auth_invalid");
  });

  it("tasdiqlanmagan akkaunt to'qnashuvi → xato kodi bilan qaytariladi, sessiya ochilmaydi", async () => {
    vi.mocked(loginWithGoogle).mockRejectedValue(apiError(409, "email_unverified_account"));
    const user = { id: "google-sub" } as User;
    const result = await googleSignIn({ user, account: google }, deps());
    expect(result).toBe("/kirish?authError=email_unverified_account");
    expect(user).not.toHaveProperty("backend");
  });

  it("backend o'chiq bo'lsa ham xato kodi bilan", async () => {
    vi.mocked(loginWithGoogle).mockRejectedValue(apiError(0, "network_error"));
    const result = await googleSignIn({ user: {} as User, account: google }, deps());
    expect(result).toBe("/kirish?authError=network_error");
  });
});
