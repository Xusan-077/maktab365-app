import { revalidateTag } from "next/cache";
import { newRequestId, REQUEST_ID_HEADER, resolveBaseUrl } from "@/lib/api/http-client";
import { clientInfoFrom, forwardHeaders } from "./backend";
import {
  changesPublicContent,
  errorResponse,
  isSameOrigin,
  SAFE_METHODS,
  upstreamPath,
} from "./request-guards";
import { effectiveTokens, readSessionToken } from "./server-token";

/**
 * BFF: brauzer → `/api/backend/api/v1/...` → backend, sessiya cookie'sidan `Authorization: Bearer`.
 * Route `auth()` bilan o'ralgan: muddati yaqin access shu yerda yangilanadi va cookie saqlanadi.
 */

const UPSTREAM_TIMEOUT_MS = 15_000;
const REQUEST_HEADERS = ["accept", "accept-language", "content-type", REQUEST_ID_HEADER];
const RESPONSE_HEADERS = ["content-type", "content-disposition", "retry-after", REQUEST_ID_HEADER];

export async function proxyToBackend(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = upstreamPath(url.pathname);
  if (!path) return errorResponse(404, "not_found", "Not found.");
  if (!isSameOrigin(request)) return errorResponse(403, "csrf_failed", "Cross-site request.");

  const headers = new Headers();
  for (const name of REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (!headers.has(REQUEST_ID_HEADER)) headers.set(REQUEST_ID_HEADER, newRequestId());
  for (const [name, value] of Object.entries(forwardHeaders(clientInfoFrom(request.headers)))) {
    headers.set(name, value);
  }

  const tokens = effectiveTokens(await readSessionToken(request.headers));
  if (tokens) headers.set("Authorization", `Bearer ${tokens.access}`);

  let upstream: Response;
  try {
    upstream = await fetch(`${resolveBaseUrl()}${path}${url.search}`, {
      method: request.method,
      headers,
      body: SAFE_METHODS.has(request.method) ? undefined : await request.arrayBuffer(),
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    return errorResponse(502, "network_error", "Backend is unreachable.");
  }

  if (changesPublicContent(request.method, path, upstream.status)) {
    revalidateTag("content", { expire: 0 });
  }

  const responseHeaders = new Headers({ "Cache-Control": "no-store" });
  for (const name of RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}
