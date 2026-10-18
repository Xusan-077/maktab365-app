"use client";

import { useEffect, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useMe } from "@/hooks/useMe";
import { useRouter } from "@/lib/i18n/navigation";
import { dashboardPath, ROUTES } from "@/lib/utils/routes";
import type { UserRole } from "@/types/user";

export function GateSkeleton() {
  const t = useTranslations("auth");
  return (
    <div role="status" className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-10">
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

/**
 * Himoyalangan sahifalar uchun mijoz tomondagi qo'riqchi (server tomonda `proxy.ts` sessiyani tekshiradi):
 * profili yo'q foydalanuvchi onboarding'ga, boshqa rol sahifasiga kirgan esa o'z sahifasiga yo'naltiriladi.
 */
export function AccountGate({ role, children }: { role?: UserRole; children: ReactNode }) {
  const { status } = useAuth();
  const { data: me } = useMe();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.replace(ROUTES.login);
    else if (me === null) router.replace(ROUTES.onboarding);
    else if (me && role && me.role !== role) router.replace(dashboardPath(me.role));
  }, [status, me, role, router]);

  if (status !== "authenticated" || !me || (role && me.role !== role)) return <GateSkeleton />;
  return children;
}
