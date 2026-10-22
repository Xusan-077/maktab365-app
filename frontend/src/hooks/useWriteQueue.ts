"use client";

import { getWriteQueue } from "@/lib/offline/pdf-write-queue";
import type { WriteQueue } from "@/lib/offline/write-queue";
import { useAuth } from "./useAuth";

/** Kirgan foydalanuvchining yozuvlar navbati; mehmonda `null` (u brauzerda saqlaydi). */
export function useWriteQueue(): WriteQueue | null {
  const { sessionUser, signedIn } = useAuth();
  return signedIn && sessionUser?.id ? getWriteQueue(sessionUser.id) : null;
}
