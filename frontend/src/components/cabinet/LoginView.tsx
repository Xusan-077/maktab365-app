"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { SignInButton } from "@/components/layout/SignInButton";
import { buttonVariants } from "@/components/ui/Button";
import { BACKEND_AUTH } from "@/lib/auth/config";
import { Link } from "@/lib/i18n/navigation";
import { ROUTES, safeCallbackPath } from "@/lib/utils/routes";

/**
 * Kirish sahifasi. `NEXT_PUBLIC_BACKEND_AUTH=true` — email+parol tablari, ostida Google (eski oqim);
 * aks holda faqat Google. Login ixtiyoriy, shuning uchun "kirmasdan davom etish" doim ko'rinadi.
 */
export function LoginView() {
  const t = useTranslations("auth");
  const tf = useTranslations("authForm");
  const searchParams = useSearchParams();
  const callbackUrl = safeCallbackPath(searchParams.get("callbackUrl"));

  return (
    <AuthCard title={t("loginTitle")} text={t("loginText")}>
      {BACKEND_AUTH && (
        <>
          <AuthPanel
            callbackUrl={callbackUrl}
            initialMode={searchParams.get("mode") === "register" ? "register" : "login"}
          />
          <div className="text-muted flex items-center gap-3 text-sm" aria-hidden>
            <span className="bg-border h-px flex-1" />
            {tf("or")}
            <span className="bg-border h-px flex-1" />
          </div>
        </>
      )}
      <div className="flex flex-col gap-3">
        <SignInButton
          provider="google"
          size="lg"
          variant={BACKEND_AUTH ? "secondary" : "primary"}
          redirectPath={callbackUrl}
        >
          {BACKEND_AUTH ? tf("google") : t("signInGoogle")}
        </SignInButton>
        <Link href={ROUTES.textbooks} className={buttonVariants({ variant: "ghost", size: "lg" })}>
          {t("continueAsGuest")}
        </Link>
      </div>
    </AuthCard>
  );
}
