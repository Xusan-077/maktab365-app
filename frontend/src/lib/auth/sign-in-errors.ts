import { ApiError } from "@/lib/api/types";

const CODE = /^[a-z][a-z_]*$/;

/** Backend xatosidan bitta kod: maydon xatolarida avval email, keyin parol. */
export function signInErrorCode(error: unknown): string {
  if (!(error instanceof ApiError)) return "unknown";
  if (error.code === "validation_error") {
    const first = error.details?.email?.[0] ?? error.details?.password?.[0];
    return first && CODE.test(first) ? first : "validation_error";
  }
  return CODE.test(error.code) ? error.code : "unknown";
}
