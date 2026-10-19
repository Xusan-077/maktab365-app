import createClient from "openapi-fetch";
import type { paths } from "./schema";
import { ApiError, type ApiErrorBody } from "./types";

export const DEFAULT_API_URL = "http://localhost:8000";
export const DEFAULT_TIMEOUT_MS = 10_000;
export const REQUEST_ID_HEADER = "X-Request-ID";

/** Brauzerda `NEXT_PUBLIC_API_URL`, serverda `API_URL` (bo'lmasa `NEXT_PUBLIC_API_URL`). */
export function resolveBaseUrl(): string {
  const publicUrl = process.env.NEXT_PUBLIC_API_URL;
  const url = typeof window === "undefined" ? (process.env.API_URL ?? publicUrl) : publicUrl;
  return (url || DEFAULT_API_URL).replace(/\/+$/, "");
}

/** 32 belgili hex — backend `X-Request-ID` uchun yaroqli (8–64 belgi, `[A-Za-z0-9._-]`). */
export function newRequestId(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

export type HttpClientOptions = {
  baseUrl?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
};

function isErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ApiErrorBody).code === "string" &&
    typeof (value as ApiErrorBody).message === "string"
  );
}

/** Tarmoq/timeout xatolarini `ApiError` ga o'raydi; HTTP xatolari `unwrap` da qayta ishlanadi. */
function createFetch(options: HttpClientOptions): typeof fetch {
  const baseFetch = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const requestId = newRequestId();
    request.headers.set(REQUEST_ID_HEADER, requestId);

    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = request.signal ? AbortSignal.any([request.signal, timeout]) : timeout;
    try {
      return await baseFetch(new Request(request, { signal }));
    } catch (error) {
      if (timeout.aborted) {
        throw new ApiError("So'rov vaqti tugadi", 0, { code: "timeout", requestId });
      }
      if (request.signal.aborted) throw error;
      throw new ApiError("Backend bilan aloqa yo'q", 0, { code: "network_error", requestId });
    }
  };
}

export function createHttpClient(options: HttpClientOptions = {}) {
  return createClient<paths>({
    baseUrl: options.baseUrl ?? resolveBaseUrl(),
    fetch: createFetch(options),
  });
}

export type HttpClient = ReturnType<typeof createHttpClient>;

type Result<T> = { data?: T; error?: unknown; response: Response };

/** `openapi-fetch` natijasidan ma'lumotni oladi; xato bo'lsa `{code,message,details}` dan `ApiError` yasaydi. */
export function unwrap<T>(result: Result<T>): T {
  if (result.error === undefined && result.data !== undefined) return result.data;
  throw toApiError(result.response, result.error);
}

export function toApiError(response: Response, body: unknown): ApiError {
  const requestId = response.headers.get(REQUEST_ID_HEADER) ?? undefined;
  if (isErrorBody(body)) {
    return new ApiError(body.message, response.status, {
      code: body.code,
      details: body.details,
      requestId,
    });
  }
  return new ApiError(response.statusText || "Kutilmagan javob", response.status, {
    code: "unexpected_response",
    requestId,
  });
}
