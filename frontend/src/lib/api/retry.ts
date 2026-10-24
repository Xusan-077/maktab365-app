import { ApiError } from "./types";

const MAX_RETRIES = 3;

/**
 * react-query `retry`: 4xx (ruxsat yo'q, topilmadi…) qayta urinish bilan tuzalmaydi — darrov
 * to'xtaydi; tarmoq/5xx xatolari standart kabi 3 martagacha qayta uriniladi.
 */
export function retryUnlessClientError(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < MAX_RETRIES;
}
