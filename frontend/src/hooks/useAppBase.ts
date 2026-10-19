"use client";

import { usePathname } from "@/lib/i18n/navigation";
import { appBaseOfPath, ROUTES, roleBase, type AppBase } from "@/lib/utils/routes";
import { useMe } from "./useMe";

const isSettingsPath = (pathname: string) =>
  pathname === ROUTES.settings || pathname.startsWith(`${ROUTES.settings}/`);

/**
 * Havolalar qaysi bazaga ketishi: `/kabinet/**` → kabinet, `/ustoz/**` → ustoz.
 * `/sozlamalar` ikkala rol uchun umumiy, shuning uchun baza profil roliga qarab olinadi.
 */
export function useAppBase(): AppBase {
  const pathname = usePathname();
  const { data: me } = useMe();
  const fromPath = appBaseOfPath(pathname);
  if (fromPath) return fromPath;
  if (isSettingsPath(pathname)) return me ? roleBase(me.role) : "kabinet";
  return "marketing";
}
