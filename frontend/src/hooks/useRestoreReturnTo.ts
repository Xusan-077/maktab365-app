"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { isReturnLanding, takeReturnTo } from "@/lib/auth/return-to";

/**
 * Google orqali kirgach foydalanuvchi panel bosh sahifasiga tushadi; kirishdan oldingi sahifa
 * (`saveReturnTo`) saqlangan bo'lsa, shu yerga qaytariladi.
 */
export function useRestoreReturnTo() {
  const { status } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (status !== "authenticated" || !isReturnLanding(pathname)) return;
    const target = takeReturnTo();
    if (target) router.replace(target);
  }, [status, pathname, router]);
}
