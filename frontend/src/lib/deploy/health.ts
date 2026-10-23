import { apiRevisionOf, isCompatible, type BackendHealth } from "./backend-revision";

export interface FrontendHealth {
  status: "ok" | "degraded";
  frontend: { commit: string; environment: string; required_api_revision: number };
  backend:
    | { reachable: false; error: string }
    | {
        reachable: true;
        status: string;
        commit: string;
        api_revision: number;
        environment: string;
        compatible: boolean;
        checks: Record<string, string>;
      };
}

export const shortCommit = (value: string | undefined) => value?.trim().slice(0, 7) || "unknown";

interface Input {
  commit?: string;
  environment?: string;
  required: number;
  /** `null` — backend'ga ulanib bo'lmadi. */
  backend: { health: BackendHealth | null; error?: string };
}

/** Deploydan keyingi tekshiruv javobi: ikkala tomon versiyasi va moslik. Sir yo'q. */
export function buildHealth({ commit, environment, required, backend }: Input): FrontendHealth {
  const frontend = {
    commit: shortCommit(commit),
    environment: environment?.trim() || "local",
    required_api_revision: required,
  };
  if (!backend.health) {
    return {
      status: "degraded",
      frontend,
      backend: { reachable: false, error: backend.error ?? "unreachable" },
    };
  }
  const { health } = backend;
  const compatible = isCompatible(health, required);
  const backendOk = health.status === "ok";
  return {
    status: backendOk && compatible ? "ok" : "degraded",
    frontend,
    backend: {
      reachable: true,
      status: health.status ?? "unknown",
      commit: health.version?.commit ?? "unknown",
      api_revision: apiRevisionOf(health),
      environment: health.version?.environment ?? "unknown",
      compatible,
      checks: health.checks ?? {},
    },
  };
}
