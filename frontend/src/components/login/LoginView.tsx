"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { PasswordStep } from "@/components/auth/LoginForm";
import { MAIN_CONTENT_ID } from "@/components/layout/SkipLink";
import { Link } from "@/lib/i18n/navigation";
import type { PdfBook } from "@/lib/pdf-books/api";
import { ROUTES, safeCallbackPath } from "@/lib/utils/routes";
import { BrandPanel } from "./BrandPanel";
import { EmailCodeForm } from "./EmailCodeForm";
import { MobileBanner } from "./MobileBanner";
import { PreferencesBar } from "./PreferencesBar";
import { SocialButtons } from "./SocialButtons";

/**
 * Kirish sahifasi: desktopda ikki ustun (brend paneli + forma), mobilda banner ustida forma.
 * Kirish ixtiyoriy; asosiy yo'l — emailga 6 xonali kod (hisob avtomatik yaratiladi). Parolli kirish —
 * kichik zaxira havola (admin va eski hisoblar). `?authError=` — Google callback'idagi xato kodi.
 */
export function LoginView({ covers }: { covers: PdfBook[] }) {
  const t = useTranslations("login");
  const searchParams = useSearchParams();
  const callbackUrl = safeCallbackPath(searchParams.get("callbackUrl"));
  const [email, setEmail] = useState(searchParams.get("email")?.trim() ?? "");
  const [step, setStep] = useState<"code" | "password">("code");

  return (
    <div className="bg-brand-panel flex min-h-dvh flex-col lg:grid lg:grid-cols-2 lg:bg-transparent">
      <MobileBanner books={covers} />
      <BrandPanel books={covers} />

      <div className="bg-auth-panel text-auth-text relative -mt-5 flex flex-1 flex-col rounded-t-[28px] px-5 pt-7 pb-6 lg:mt-0 lg:rounded-none lg:px-12 lg:py-8">
        <div className="hidden items-center justify-end gap-4 lg:flex">
          <PreferencesBar />
          <Link
            href={ROUTES.textbooks}
            className="text-brand-text focus-visible:ring-brand-ring inline-flex min-h-11 items-center gap-1 rounded-lg text-[15px] font-semibold outline-none hover:underline focus-visible:ring-4"
          >
            {t("readWithout")}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>

        <main
          id={MAIN_CONTENT_ID}
          tabIndex={-1}
          className="mx-auto flex w-full max-w-[380px] flex-1 flex-col gap-5 focus:outline-none lg:justify-center lg:gap-7"
        >
          <div className="order-1 flex flex-col gap-2">
            <h1 className="text-[28px] leading-tight font-extrabold lg:text-[34px]">
              {t("welcome")}
            </h1>
            <p className="text-auth-muted text-[15px] lg:text-base">
              <span className="lg:hidden">{t("subtitleMobile")}</span>
              <span className="hidden lg:inline">{t("subtitleDesktop")}</span>
            </p>
          </div>

          {step === "code" ? (
            <EmailCodeForm
              initialEmail={email}
              callbackUrl={callbackUrl}
              onUsePassword={(value) => {
                setEmail(value);
                setStep("password");
              }}
              className="order-2 lg:order-4"
            />
          ) : (
            <div className="order-2 lg:order-4">
              <PasswordStep
                email={email}
                callbackUrl={callbackUrl}
                onChangeEmail={() => setStep("code")}
              />
            </div>
          )}

          <div
            aria-hidden
            className="text-auth-subtle order-3 flex items-center gap-3 text-[14px] lg:order-3"
          >
            <span className="bg-auth-border h-px flex-1" />
            <span className="lg:hidden">{t("or")}</span>
            <span className="hidden lg:inline">{t("orEmail")}</span>
            <span className="bg-auth-border h-px flex-1" />
          </div>

          <SocialButtons
            callbackUrl={callbackUrl}
            initialError={searchParams.get("authError") ?? undefined}
            className="order-4 mt-auto lg:order-2 lg:mt-0"
          />
        </main>

        <div className="mx-auto mt-6 flex w-full max-w-[380px] flex-col items-center gap-4 lg:mt-0">
          <p className="text-auth-subtle text-center text-[12px] lg:text-[13px]">
            {t.rich("legal", {
              terms: (chunks) => (
                <Link href={ROUTES.about} className="text-brand-text font-semibold hover:underline">
                  {chunks}
                </Link>
              ),
              privacy: (chunks) => (
                <Link href={ROUTES.about} className="text-brand-text font-semibold hover:underline">
                  {chunks}
                </Link>
              ),
            })}
          </p>
          <PreferencesBar className="lg:hidden" />
        </div>
      </div>
    </div>
  );
}
