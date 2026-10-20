"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { SocialSignIn } from "@/components/auth/SocialSignIn";
import { buttonVariants } from "@/components/ui/Button";
import { Link } from "@/lib/i18n/navigation";
import { ROUTES, safeCallbackPath } from "@/lib/utils/routes";

/**
 * Kirish sahifasi: email+parol tablari, ostida Google, Telegram va email kodi. Login ixtiyoriy,
 * shuning uchun "kirmasdan davom etish" doim ko'rinadi. `?authError=` — Google callback'idagi xato kodi.
 */
export function LoginView() {
  const t = useTranslations("auth");
  const tf = useTranslations("authForm");
  const searchParams = useSearchParams();
  const callbackUrl = safeCallbackPath(searchParams.get("callbackUrl"));

  return (
    <AuthCard title={t("loginTitle")} text={t("loginText")}>
      <AuthPanel
        callbackUrl={callbackUrl}
        initialMode={searchParams.get("mode") === "register" ? "register" : "login"}
      />
      <div className="text-muted flex items-center gap-3 text-sm" aria-hidden>
        <span className="bg-border h-px flex-1" />
        {tf("or")}
        <span className="bg-border h-px flex-1" />
      </div>
      <SocialSignIn
        callbackUrl={callbackUrl}
        initialError={searchParams.get("authError") ?? undefined}
      />
      <Link href={ROUTES.textbooks} className={buttonVariants({ variant: "ghost", size: "lg" })}>
        {t("continueAsGuest")}
      </Link>
    </AuthCard>
  );
}
