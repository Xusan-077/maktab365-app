"use client";

import { useRestoreReturnTo } from "@/hooks/useRestoreReturnTo";

/** Ko'rinmaydigan: Google'dan qaytgach kirishdan oldingi sahifaga o'tkazadi (`usePathname` — Suspense ichida). */
export function ReturnToRestorer() {
  useRestoreReturnTo();
  return null;
}
