"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { ROUTES, safeCallbackPath } from "@/lib/utils/routes";
import { AuthCard } from "./AuthCard";
import { AuthDivider } from "./AuthDivider";
import { RegisterForm } from "./RegisterForm";
import { SocialSignIn } from "./SocialSignIn";

/** Ro'yxatdan o'tish sahifasi: kirish bilan bir xil uslub — Google/Telegram yuqorida, keyin forma. */
export function RegisterView() {
  const t = useTranslations("authForm");
  const searchParams = useSearchParams();
  const callbackUrl = safeCallbackPath(searchParams.get("callbackUrl"));

  return (
    <AuthCard title={t("registerTitle")} text={t("registerText")}>
      <SocialSignIn callbackUrl={callbackUrl} />
      <AuthDivider />
      <RegisterForm callbackUrl={callbackUrl} />
      <p className="text-muted text-center text-sm">
        {t("haveAccount")}{" "}
        <Link href={ROUTES.login} className="text-link font-medium hover:underline">
          {t("loginLink")}
        </Link>
      </p>
    </AuthCard>
  );
}
