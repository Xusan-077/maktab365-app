import { ApiError } from "@/lib/api/types";

/** `admin.errors.codes.*` da matni bor barqaror xato kodlari. */
export const KNOWN_ERROR_CODES = [
  "transition_forbidden",
  "invalid_transition",
  "has_dependents",
  "file_too_large",
  "unsupported_type",
  "invalid_kind",
  "file_empty",
  "invalid_pdf",
  "pdf_encrypted",
  "no_file",
  "no_pending_upload",
  "upload_incomplete",
  "direct_upload_required",
  "invalid_parts",
  "upload_failed",
  "network_error",
  "timeout",
  "not_authenticated",
  "permission_denied",
  "not_found",
  "throttled",
  "env_admin_protected",
  "self_action_forbidden",
  "last_admin",
  "role_forbidden",
  "storage_error",
] as const;

export type KnownErrorCode = (typeof KNOWN_ERROR_CODES)[number];

export function knownErrorCode(error: unknown): KnownErrorCode | null {
  if (!(error instanceof ApiError)) return null;
  return KNOWN_ERROR_CODES.find((code) => code === error.code) ?? null;
}

/** Maydon xatolari (`details`) dan birinchi kod: `{ slug: ["slug_taken"] }` → `slug_taken`. */
export function fieldErrorCode(error: unknown, field: string): string | undefined {
  if (!(error instanceof ApiError)) return undefined;
  const messages = error.details?.[field];
  return Array.isArray(messages) ? messages[0] : undefined;
}

/** Forma maydonlari, backend xatosi kelganda ko'rsatiladigan joy. */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || error.code !== "validation_error" || !error.details) {
    return {};
  }
  const result: Record<string, string> = {};
  for (const [field, messages] of Object.entries(error.details)) {
    const first = Array.isArray(messages) ? messages[0] : undefined;
    if (first) result[field] = first;
  }
  return result;
}
