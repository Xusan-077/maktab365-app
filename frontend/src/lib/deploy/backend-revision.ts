import revision from "../../../backend-revision.json";

/** Frontend ishlashi uchun backend'ning eng kam `api_revision` qiymati (`backend-revision.json`). */
export const REQUIRED_API_REVISION: number = revision.min;

export interface BackendHealth {
  status?: string;
  checks?: Record<string, string>;
  version?: { commit?: string; api_revision?: number; environment?: string };
}

/** `version` yo'q (eski backend) — 1-versiya deb hisoblanadi. */
export function apiRevisionOf(health: BackendHealth | null | undefined): number {
  const value = health?.version?.api_revision;
  return typeof value === "number" && Number.isFinite(value) ? value : 1;
}

export function isCompatible(health: BackendHealth | null | undefined, required: number): boolean {
  return apiRevisionOf(health) >= required;
}
