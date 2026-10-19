import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/Badge";
import { Card, CardTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/layout/PageHeader";
import { PAGE_STACK } from "@/components/layout/containers";
import { API_MODE } from "@/lib/api";
import { HttpApi } from "@/lib/api/http-api";
import { resolveBaseUrl } from "@/lib/api/http-client";
import { ApiError, type HealthStatus } from "@/lib/api/types";

type Probe = { health: HealthStatus; error?: undefined } | { health?: undefined; error: ApiError };

async function probe(): Promise<Probe> {
  try {
    return { health: await new HttpApi().health() };
  } catch (error) {
    if (error instanceof ApiError) return { error };
    throw error;
  }
}

/** Backend `/health/` natijasi (server tomonda so'raladi, `API_URL` bilan). Faqat development. */
export async function ApiStatus() {
  const t = await getTranslations("devApi");
  const result = await probe();
  const state = result.health?.status;

  return (
    <div className={PAGE_STACK}>
      <PageHeader title={t("title")} description={t("intro")} />

      <Card className="flex flex-col gap-3">
        <CardTitle>{t("backend")}</CardTitle>
        <dl className="grid grid-cols-[max-content_1fr] items-center gap-x-6 gap-y-2">
          <dt className="text-muted">{t("mode")}</dt>
          <dd data-testid="api-mode">{API_MODE}</dd>
          <dt className="text-muted">{t("baseUrl")}</dt>
          <dd>{resolveBaseUrl()}</dd>
          <dt className="text-muted">{t("backend")}</dt>
          <dd data-testid="api-status">
            {state ? (
              <Badge>{state === "ok" ? t("ok") : t("degraded")}</Badge>
            ) : (
              <Badge>{t("unreachable")}</Badge>
            )}
          </dd>
          {result.health && (
            <>
              <dt className="text-muted">{t("database")}</dt>
              <dd>{t(result.health.checks.database)}</dd>
              <dt className="text-muted">{t("redis")}</dt>
              <dd>{t(result.health.checks.redis)}</dd>
            </>
          )}
          {result.error?.requestId && (
            <>
              <dt className="text-muted">{t("requestId")}</dt>
              <dd className="font-mono text-sm">{result.error.requestId}</dd>
            </>
          )}
        </dl>
        {API_MODE === "mock" && <p className="text-muted text-sm">{t("mockMode")}</p>}
      </Card>
    </div>
  );
}
