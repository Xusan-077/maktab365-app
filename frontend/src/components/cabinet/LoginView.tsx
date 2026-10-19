"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { SignInButton } from "@/components/layout/SignInButton";
import { buttonVariants } from "@/components/ui/Button";
import { Link } from "@/lib/i18n/navigation";
import { ROUTES, safeCallbackPath } from "@/lib/utils/routes";

/** Google bilan kirish sahifasi. Login ixtiyoriy, shuning uchun "kirmasdan davom etish" doim ko'rinadi. */
export function LoginView() {
  const t = useTranslations("auth");
  const callbackUrl = safeCallbackPath(useSearchParams().get("callbackUrl"));

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-14 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-balance">{t("loginTitle")}</h1>
        <p className="text-muted">{t("loginText")}</p>
      </header>
      <div className="flex flex-col gap-3">
        <SignInButton size="lg" redirectPath={callbackUrl}>
          {t("signInGoogle")}
        </SignInButton>
        <Link href={ROUTES.textbooks} className={buttonVariants({ variant: "ghost", size: "lg" })}>
          {t("continueAsGuest")}
        </Link>
      </div>
    </div>
  );
}
