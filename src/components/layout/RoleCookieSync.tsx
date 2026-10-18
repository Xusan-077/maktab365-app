"use client";

import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMe } from "@/hooks/useMe";
import { ROLE_COOKIE_MAX_AGE, ROLE_COOKIE_NAME } from "@/lib/utils/role-cookie";

/** Profil rolini `proxy.ts` o'qiy oladigan cookie'ga yozadi; chiqqanda yoki profil yo'q bo'lsa o'chiradi. */
export function RoleCookieSync() {
  const { status } = useAuth();
  const { data: me } = useMe();

  useEffect(() => {
    if (status === "loading" || (status === "authenticated" && me === undefined)) return;
    document.cookie = me
      ? `${ROLE_COOKIE_NAME}=${me.role}; path=/; max-age=${ROLE_COOKIE_MAX_AGE}; samesite=lax`
      : `${ROLE_COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
  }, [status, me]);

  return null;
}
