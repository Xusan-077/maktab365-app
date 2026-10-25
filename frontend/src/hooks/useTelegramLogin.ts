import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { signIn } from "next-auth/react";
import { useLocale } from "next-intl";
import { ApiError } from "@/lib/api/types";
import { TELEGRAM_BOT_PROVIDER } from "@/lib/auth/config";
import {
  fetchTelegramLoginStatus,
  requestTelegramLogin,
  TELEGRAM_POLL_MS,
  type TelegramLoginLink,
} from "@/lib/auth/telegram-login";

export type TelegramLoginPhase =
  "idle" | "starting" | "pending" | "confirming" | "expired" | "error";

interface ActiveLink extends TelegramLoginLink {
  expiresAt: number;
}

const errorCode = (error: unknown) => (error instanceof ApiError ? error.code : "unknown");

/** Har soniyada yangilanadigan joriy vaqt (faqat `active` bo'lganda). */
function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

/**
 * Telegram bot orqali kirish: `start()` → bot havolasi; holat `TELEGRAM_POLL_MS` da so'raladi
 * (tab yashirin bo'lsa TanStack Query to'xtatadi), muddat tugasa yoki `confirmed`/`expired`
 * bo'lsa polling to'xtaydi. `confirmed` → `signIn("telegram-bot")` (token bir martalik) → `onSignedIn`.
 */
export function useTelegramLogin({
  onSignedIn,
  onLink,
}: {
  onSignedIn: () => void | Promise<void>;
  /** Havola olingach (masalan, mobilda darhol Telegram'ni ochish uchun). */
  onLink?: (link: TelegramLoginLink) => void;
}) {
  const locale = useLocale();
  const [link, setLink] = useState<ActiveLink | null>(null);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const consumed = useRef<string | null>(null);
  const now = useNow(link !== null && !confirming);
  const timedOut = link !== null && now >= link.expiresAt;

  const start = useMutation({
    mutationFn: requestTelegramLogin,
    onSuccess: (data) => {
      setLink({ ...data, expiresAt: Date.now() + data.expires_in * 1000 });
      onLink?.(data);
    },
  });

  const status = useQuery({
    queryKey: ["telegram-login", link?.token],
    queryFn: () => fetchTelegramLoginStatus(link!.token),
    enabled: link !== null && !timedOut && !confirming && signInError === null,
    // Xato (masalan, 403 — boshqa brauzer) bo'lsa ham to'xtaydi: foydalanuvchi "Qayta urinish" bosadi.
    refetchInterval: (query) =>
      query.state.status !== "error" &&
      (query.state.data === undefined || query.state.data === "pending")
        ? TELEGRAM_POLL_MS
        : false,
    refetchIntervalInBackground: false,
    retry: (count, error) => !(error instanceof ApiError && error.status === 403) && count < 2,
    gcTime: 0,
    staleTime: 0,
  });

  useEffect(() => {
    if (status.data !== "confirmed" || !link || consumed.current === link.token) return;
    consumed.current = link.token;
    setConfirming(true);
    void (async () => {
      const result = await signIn(TELEGRAM_BOT_PROVIDER, {
        redirect: false,
        token: link.token,
        locale,
      }).catch(() => ({ error: "network", code: "network_error" }));
      if (result?.error) {
        setSignInError(result.code ?? "unknown");
        setConfirming(false);
        return;
      }
      await onSignedIn();
    })();
  }, [status.data, link, locale, onSignedIn]);

  const reset = useCallback(() => {
    setLink(null);
    setSignInError(null);
    setConfirming(false);
    consumed.current = null;
    start.reset();
  }, [start]);

  const retry = useCallback(() => {
    reset();
    start.mutate();
  }, [reset, start]);

  let phase: TelegramLoginPhase;
  let error: string | null = null;
  if (start.isPending) phase = "starting";
  else if (start.isError) {
    phase = "error";
    error = errorCode(start.error);
  } else if (!link) phase = "idle";
  else if (signInError) {
    phase = "error";
    error = signInError;
  } else if (confirming) phase = "confirming";
  else if (status.data === "expired" || timedOut) phase = "expired";
  else if (status.isError) {
    phase = "error";
    error = errorCode(status.error);
  } else phase = "pending";

  return {
    phase,
    error,
    link,
    // `now` havoladan oldingi so'nggi tikda qolgan bo'lishi mumkin — sanoq muddatdan oshmasin.
    remainingMs: link ? Math.min(link.expires_in * 1000, Math.max(0, link.expiresAt - now)) : 0,
    start: () => start.mutate(),
    retry,
  };
}
