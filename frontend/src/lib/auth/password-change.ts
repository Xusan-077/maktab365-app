import { ApiError } from "@/lib/api/types";
import { changePasswordKeepingSession, clientInfoFrom } from "./backend";
import { errorResponse, isSameOrigin } from "./request-guards";
import { effectiveTokens, readSessionToken } from "./server-token";

/**
 * Parolni almashtirish: backend'ga joriy sessiya refresh'i ham yuboriladi — u saqlanadi,
 * boshqa qurilmalardagi sessiyalar bekor bo'ladi. Refresh brauzerga chiqmasligi uchun BFF emas,
 * alohida server route.
 */
export async function handlePasswordChange(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return errorResponse(403, "csrf_failed", "Cross-site request.");
  const tokens = effectiveTokens(await readSessionToken(request.headers));
  if (!tokens) return errorResponse(401, "not_authenticated", "Sign in required.");

  let body: { current_password?: unknown; new_password?: unknown };
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "validation_error", "Invalid JSON.");
  }
  const input = {
    current_password: typeof body.current_password === "string" ? body.current_password : "",
    new_password: typeof body.new_password === "string" ? body.new_password : "",
  };

  try {
    return Response.json(
      await changePasswordKeepingSession(tokens, input, clientInfoFrom(request.headers)),
    );
  } catch (error) {
    if (error instanceof ApiError && error.status > 0) {
      return Response.json(
        { code: error.code, message: error.message, details: error.details },
        { status: error.status },
      );
    }
    return errorResponse(502, "network_error", "Backend is unreachable.");
  }
}
