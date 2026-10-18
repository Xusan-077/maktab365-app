"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/hooks/useAuth";
import { useMe } from "@/hooks/useMe";
import { useRouter } from "@/lib/i18n/navigation";
import { dashboardPath, ROUTES } from "@/lib/utils/routes";
import { GateSkeleton } from "./AccountGate";
import { ProfileForm } from "./ProfileForm";

/**
 * Birinchi kirishdagi onboarding. Profili bor foydalanuvchi qayta so'ralmaydi: rolga mos sahifaga
 * (o'quvchi → kabinet, o'qituvchi → ustoz) yo'naltiriladi; saqlangandan keyin ham shu yo'l ishlaydi.
 */
export function OnboardingView() {
  const t = useTranslations("onboarding");
  const { status, sessionUser } = useAuth();
  const { data: me } = useMe();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.replace(ROUTES.login);
    else if (me) router.replace(dashboardPath(me.role));
  }, [status, me, router]);

  if (status !== "authenticated" || me !== null) return <GateSkeleton />;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-balance">{t("title")}</h1>
        <p className="text-muted">{t("text")}</p>
      </header>
      <ProfileForm defaultName={sessionUser?.name ?? ""} submitLabel={t("submit")} />
    </div>
  );
}
