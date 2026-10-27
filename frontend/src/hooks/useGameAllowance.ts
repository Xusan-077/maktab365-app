"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import type { GameAllowance } from "@/lib/games/api";
import {
  consumeGuest,
  guestAllowance,
  readGuestRecord,
  writeGuestRecord,
  GUEST_ALLOWANCE_STORAGE_KEY,
  type GuestAllowance,
} from "@/lib/games/guest-allowance";
import { gameQueries } from "@/lib/games/queries";

export type AllowanceState =
  | { kind: "loading" }
  | { kind: "guest"; guest: GuestAllowance }
  | { kind: "user"; allowance: GameAllowance }
  /** Kirgan, lekin server javob bermadi — chiplar ko'rsatilmaydi, boshlashda server hal qiladi. */
  | { kind: "unknown" };

// --- Mehmon yozuvi: shu tab va boshqa tablardagi o'zgarishlarga obuna ---
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === GUEST_ALLOWANCE_STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** `useSyncExternalStore` bir xil qiymatni kutadi: yozuv JSON ko'rinishida solishtiriladi. */
const guestSnapshot = () => JSON.stringify(readGuestRecord());
const serverSnapshot = () => "loading";

/** Mehmon uchun bitta o'yin sarflaydi; limit tugagan bo'lsa `false`. */
export function consumeGuestGame(now = new Date()): boolean {
  const next = consumeGuest(readGuestRecord(), now);
  if (!next) return false;
  writeGuestRecord(next);
  emit();
  return true;
}

/**
 * Oylik bepul o'yinlar va tanga balansi: kirganda — server (`/games/allowance/`), mehmonda —
 * `localStorage` (`lib/games/guest-allowance.ts`).
 */
export function useGameAllowance(): AllowanceState {
  const { status } = useAuth();
  const signedIn = status === "authenticated";
  const query = useQuery({ ...gameQueries.allowance(), enabled: signedIn });
  const snapshot = useSyncExternalStore(subscribe, guestSnapshot, serverSnapshot);
  const guest = useCallback(
    (raw: string) => guestAllowance(raw === "null" ? null : JSON.parse(raw), new Date()),
    [],
  );

  if (status === "loading") return { kind: "loading" };
  if (!signedIn)
    return snapshot === "loading" ? { kind: "loading" } : { kind: "guest", guest: guest(snapshot) };
  if (query.data) return { kind: "user", allowance: query.data };
  return query.isError ? { kind: "unknown" } : { kind: "loading" };
}
