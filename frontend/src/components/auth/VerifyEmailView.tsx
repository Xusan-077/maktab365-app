"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuthErrorText } from "@/hooks/useAuthErrorText";
import { authClient, errorCodeOf } from "@/lib/auth/client";
import { Link } from "@/lib/i18n/navigation";
import { dashboardPath, ROUTES } from "@/lib/utils/routes";
import { AuthCard } from "./AuthCard";
import { FormAlert } from "./FormAlert";

type State = { status: "pending" } | { status: "done" } | { status: "failed"; code: string };

/**
 * Xatdagi havola (`?token=`) ochilganda emailni tasdiqlaydi. Token bir martalik, shuning uchun
 * so'rov bir marta yuboriladi (StrictMode effektni ikki marta chaqirsa ham). Kirgan bo'lsa,
 * sessiya yangilanadi — panel banneri yo'qoladi.
 */
export function VerifyEmailView() {
  const t = useTranslations("authForm");
  const errorText = useAuthErrorText();
  const token = useSearchParams().get("token") ?? "";
  const { data: session, status, update } = useSession();
  const [state, setState] = useState<State>(() =>
    token ? { status: "pending" } : { status: "failed", code: "invalid_token" },
  );
  const sent = useRef(false);

  useEffect(() => {
    if (!token || sent.current) return;
    sent.current = true;
    authClient
      .verifyEmail(token)
      .then(() => setState({ status: "done" }))
      .catch((error: unknown) => setState({ status: "failed", code: errorCodeOf(error) }));
  }, [token]);

  useEffect(() => {
    if (state.status === "done" && status === "authenticated") void update({ refresh: "account" });
    // `update` har renderda yangi; faqat natija kelganda bir marta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, status]);

  const user = session?.user;
  const next =
    status === "authenticated" ? (
      <Link
        href={
          user?.onboarded === false ? ROUTES.onboarding : dashboardPath(user?.role ?? "student")
        }
        className={buttonVariants({ size: "lg" })}
      >
        {t("verify.continue")}
      </Link>
    ) : (
      <Link href={ROUTES.login} className={buttonVariants({ size: "lg" })}>
        {t("verify.goToLogin")}
      </Link>
    );

  if (state.status === "pending") {
    return (
      <AuthCard title={t("verify.title")}>
        <div role="status" className="flex flex-col gap-3">
          <span className="text-muted">{t("verify.verifying")}</span>
          <Skeleton className="h-12 w-full" />
        </div>
      </AuthCard>
    );
  }

  if (state.status === "done") {
    return (
      <AuthCard title={t("verify.successTitle")}>
        <FormAlert variant="success">{t("verify.successText")}</FormAlert>
        {next}
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("verify.failedTitle")}>
      <FormAlert>
        <p>{errorText(state.code)}</p>
        <p className="text-muted mt-1">{t("verify.failedHint")}</p>
      </FormAlert>
      {next}
    </AuthCard>
  );
}
