import { createHttpClient, toApiError, unwrap } from "@/lib/api/http-client";
import { ApiError } from "@/lib/api/types";

/**
 * Brauzerdan auth amallari (BFF orqali). Kirish/ro'yxatdan o'tish bu yerda emas —
 * ular Auth.js `signIn("password")` orqali (tokenlar serverda qoladi).
 */

let client: ReturnType<typeof createHttpClient> | undefined;
const api = () => (client ??= createHttpClient());

async function noContent(result: { error?: unknown; response: Response }) {
  if (result.response.status >= 400) throw toApiError(result.response, result.error);
}

export const authClient = {
  async forgotPassword(email: string) {
    return unwrap(await api().POST("/api/v1/auth/password/forgot/", { body: { email } }));
  },

  async resetPassword(token: string, password: string) {
    return unwrap(await api().POST("/api/v1/auth/password/reset/", { body: { token, password } }));
  },

  async verifyEmail(token: string) {
    return unwrap(await api().POST("/api/v1/auth/email/verify/", { body: { token } }));
  },

  async resendVerification() {
    return unwrap(await api().POST("/api/v1/auth/email/resend/"));
  },

  async logoutAll() {
    await noContent(await api().POST("/api/v1/auth/logout-all/"));
  },

  /** Joriy sessiyani saqlab parolni almashtiradi (`/api/account/password` server route'i). */
  async changePassword(input: { currentPassword: string; newPassword: string }) {
    let response: Response;
    try {
      response = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: input.currentPassword,
          new_password: input.newPassword,
        }),
      });
    } catch {
      throw new ApiError("Backend bilan aloqa yo'q", 0, { code: "network_error" });
    }
    const body: unknown = await response.json().catch(() => undefined);
    if (!response.ok) throw toApiError(response, body);
  },
};

/** `ApiError` dan i18n kodi (maydon xatolarida birinchi kod). */
export function errorCodeOf(error: unknown): string {
  if (!(error instanceof ApiError)) return "unknown";
  if (error.code === "validation_error" && error.details) {
    const first = Object.values(error.details).flat()[0];
    if (first && /^[a-z][a-z_]*$/.test(first)) return first;
  }
  return error.code;
}
