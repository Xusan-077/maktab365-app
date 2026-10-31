import createClient from "openapi-fetch";
import { BFF_PREFIX } from "@/lib/auth/config";
import { toBffUrl } from "@/lib/auth/request-guards";
import { endSession, recoverSession, shouldRecover } from "@/lib/auth/session-recovery";
import type { paths } from "./schema";
import { ApiError, type ApiErrorBody } from "./types";

export const DEFAULT_API_URL = "http://localhost:8000";
export const DEFAULT_TIMEOUT_MS = 10_000;
const NETWORK_RETRIES = 2;
const RETRY_DELAY_MS = 150;
export const REQUEST_ID_HEADER = "X-Request-ID";

/**
 * Serverda `API_URL` (bo'lmasa `NEXT_PUBLIC_API_URL`) — backend'ning o'zi.
 * Brauzerda — shu saytdagi BFF (`/api/backend`): u sessiya cookie'sidan Bearer qo'shib backend'ga
 * uzatadi, shuning uchun backend tokenlari brauzer JS'iga chiqmaydi.
 */
export function resolveBaseUrl(): string {
  if (typeof window !== "undefined") return `${window.location.origin}${BFF_PREFIX}`;
  const url = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
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
  /** Server so'rovlari uchun Bearer token (`getServerAccessToken`); `null` — tokensiz. */
  getAccessToken?: () => Promise<string | null>;
};

function isErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ApiErrorBody).code === "string" &&
    typeof (value as ApiErrorBody).message === "string"
  );
}

/**
 * Tarmoq/timeout xatolarini `ApiError` ga o'raydi; HTTP xatolari `unwrap` da qayta ishlanadi.
 * Sxemada hali yo'q endpoint'lar (`lib/topic-materials`) shu `fetch` dan to'g'ridan-to'g'ri foydalanadi.
 */
export function createFetch(options: HttpClientOptions = {}): typeof fetch {
  const baseFetch = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const requestId = newRequestId();
    request.headers.set(REQUEST_ID_HEADER, requestId);
    const accessToken = await options.getAccessToken?.();
    if (accessToken) request.headers.set("Authorization", `Bearer ${accessToken}`);

    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = request.signal ? AbortSignal.any([request.signal, timeout]) : timeout;
    // Tana buferga olinib `fetch(url, init)` bilan yuboriladi: `Request` obyekti berilsa Next serveri
    // tanani oqim (chunked) qilib yuboradi, WSGI (Django) esa uni bo'sh o'qiydi.
    const body = request.body ? await request.arrayBuffer() : undefined;
    const url = typeof window === "undefined" ? request.url : toBffUrl(request.url);
    // Faqat o'qish so'rovlari tarmoq uzilishida qayta uriniladi (backend qayta ishga tushayotgan bo'lishi mumkin).
    const attempts =
      request.method === "GET" || request.method === "HEAD" ? 1 + NETWORK_RETRIES : 1;
    let recovered = false;
    for (let attempt = 1; ; attempt += 1) {
      try {
        const response = await baseFetch(url, {
          method: request.method,
          headers: request.headers,
          body,
          signal,
        });
        // Kirgan foydalanuvchining 401'i: sessiya jim yangilanadi va so'rov bir marta takrorlanadi;
        // yangilanmasa — kirish sahifasiga (`callbackUrl` bilan).
        if (shouldRecover(response.status)) {
          if (!recovered) {
            recovered = true;
            if (await recoverSession()) {
              attempt -= 1;
              continue;
            }
          }
          await endSession();
        }
        return response;
      } catch (error) {
        if (timeout.aborted) {
          throw new ApiError("So'rov vaqti tugadi", 0, { code: "timeout", requestId });
        }
        if (request.signal.aborted) throw error;
        if (attempt >= attempts) {
          throw new ApiError("Backend bilan aloqa yo'q", 0, { code: "network_error", requestId });
        }
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
      }
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
