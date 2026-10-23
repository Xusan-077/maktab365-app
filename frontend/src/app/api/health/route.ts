import { NextResponse, connection } from "next/server";
import type { BackendHealth } from "@/lib/deploy/backend-revision";
import { REQUIRED_API_REVISION } from "@/lib/deploy/backend-revision";
import { buildHealth } from "@/lib/deploy/health";

const TIMEOUT_MS = 4_000;

async function fetchBackendHealth(): Promise<{ health: BackendHealth | null; error?: string }> {
  const base = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (!base) return { health: null, error: "API_URL is not set" };
  try {
    const response = await fetch(new URL("/api/v1/health/", base), {
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // 503 — backend ishlayapti, lekin DB/Redis xato: tanasi baribir `checks` ni beradi.
    return { health: (await response.json()) as BackendHealth };
  } catch {
    return { health: null, error: "unreachable" };
  }
}

/** Deploydan keyingi tekshiruv: frontend va backend versiyasi (commit, API versiyasi) va moslik. */
export async function GET() {
  await connection();
  const health = buildHealth({
    commit: process.env.VERCEL_GIT_COMMIT_SHA,
    environment: process.env.VERCEL_ENV,
    required: REQUIRED_API_REVISION,
    backend: await fetchBackendHealth(),
  });
  return NextResponse.json(health, {
    status: health.status === "ok" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
