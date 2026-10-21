"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthDivider } from "@/components/auth/AuthDivider";
import { EmailStep, PasswordStep } from "@/components/auth/LoginForm";
import { SocialSignIn } from "@/components/auth/SocialSignIn";
import { Link } from "@/lib/i18n/navigation";
import { ROUTES, safeCallbackPath } from "@/lib/utils/routes";

/**
 * Kirish sahifasi, bir qadamli: Google/Telegram, "yoki", email → (almashadigan panel) parol.
 * Login ixtiyoriy, shuning uchun "kirmasdan davom etish" doim eng pastda. `?authError=` — Google
 * callback'idagi xato kodi.
 */
export function LoginView() {
  const t = useTranslations("auth");
  const tf = useTranslations("authForm");
  const searchParams = useSearchParams();
  const callbackUrl = safeCallbackPath(searchParams.get("callbackUrl"));
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "password">("email");

  return (
    <AuthCard title={t("loginTitle")} text={t("loginText")}>
      {step === "email" ? (
        <>
          <SocialSignIn
            callbackUrl={callbackUrl}
            initialError={searchParams.get("authError") ?? undefined}
          />
          <AuthDivider />
          <EmailStep
            initialEmail={email}
            onContinue={(value) => {
              setEmail(value);
              setStep("password");
            }}
          />
        </>
      ) : (
        <PasswordStep
          email={email}
          callbackUrl={callbackUrl}
          onChangeEmail={() => setStep("email")}
        />
      )}
      <p className="text-muted text-center text-sm">
        {tf("noAccount")}{" "}
        <Link href={ROUTES.register} className="text-link font-medium hover:underline">
          {tf("registerLink")}
        </Link>
      </p>
      <Link
        href={ROUTES.textbooks}
        className="text-muted hover:text-foreground inline-flex min-h-11 items-center justify-center text-sm hover:underline"
      >
        {t("continueAsGuest")}
      </Link>
    </AuthCard>
  );
}
