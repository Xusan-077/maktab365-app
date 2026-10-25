"use client";

import { Loader2, RefreshCw, Send } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useTranslations } from "next-intl";
import { TelegramIcon } from "@/components/login/TelegramIcon";
import { Button } from "@/components/ui/Button";
import { useAuthErrorText } from "@/hooks/useAuthErrorText";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useTelegramLogin } from "@/hooks/useTelegramLogin";
import { formatCountdown, openTelegramLink } from "@/lib/auth/telegram-login";
import { cn } from "@/lib/utils/cn";

const telegramButton =
  "bg-telegram inline-flex h-13 w-full items-center justify-center gap-2.5 rounded-xl px-5 text-base font-semibold text-white transition-[filter,transform] hover:brightness-95 motion-safe:active:scale-[0.98] disabled:opacity-70";

/** Telefon/planshet: havola darhol Telegram ilovasida ochiladi, QR kerak emas. */
const TOUCH_QUERY = "(pointer: coarse)";

/**
 * "Telegram bilan kirish" (bot deep-link). Holatlar: tugma → (mobilda Telegram ochiladi | desktopda QR +
 * "Telegramda ochish") + 5:00 teskari sanoq → tasdiqlangach kirish; muddat tugasa yoki xato bo'lsa
 * "Qayta urinish".
 */
export function TelegramLoginPanel({
  onSignedIn,
  className,
}: {
  onSignedIn: () => void | Promise<void>;
  className?: string;
}) {
  const t = useTranslations("telegramLogin");
  const errorText = useAuthErrorText();
  const touch = useMediaQuery(TOUCH_QUERY);
  const { phase, error, link, remainingMs, start, retry } = useTelegramLogin({
    onSignedIn,
    onLink: (next) => {
      if (window.matchMedia(TOUCH_QUERY).matches) openTelegramLink(next.bot_url);
    },
  });

  if (phase === "idle" || phase === "starting") {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={start}
          disabled={phase === "starting"}
          aria-busy={phase === "starting" || undefined}
          className={telegramButton}
          data-testid="telegram-bot-login"
        >
          {phase === "starting" ? (
            <Loader2 className="size-5 animate-spin" aria-hidden />
          ) : (
            <TelegramIcon inverted className="size-6" />
          )}
          {t("start")}
        </button>
      </div>
    );
  }

  if (phase === "confirming") {
    return (
      <div
        role="status"
        className={cn("flex flex-col items-center gap-3 py-6 text-center", className)}
      >
        <Loader2 className="text-telegram size-8 animate-spin" aria-hidden />
        <p className="font-medium">{t("confirming")}</p>
      </div>
    );
  }

  if (phase === "expired" || phase === "error") {
    return (
      <div className={cn("flex flex-col items-center gap-4 py-2 text-center", className)}>
        <p role="alert" className={cn("text-sm", phase === "error" ? "text-danger" : "text-muted")}>
          {phase === "expired" ? t("expired") : errorText(error ?? "unknown")}
        </p>
        <Button variant="secondary" size="lg" onClick={retry} className="w-full">
          <RefreshCw className="size-4" aria-hidden />
          {t("retry")}
        </Button>
      </div>
    );
  }

  // pending
  return (
    <div className={cn("flex flex-col items-center gap-4 text-center", className)}>
      {!touch && link && (
        <div className="border-border rounded-xl border bg-white p-3" data-testid="telegram-qr">
          <QRCodeSVG value={link.bot_url} size={176} marginSize={0} title={t("qrTitle")} />
        </div>
      )}
      <div className="flex flex-col gap-1" role="status" aria-live="polite">
        <p className="font-semibold">{t("pending")}</p>
        <p className="text-muted text-sm">{touch ? t("pendingHintMobile") : t("pendingHint")}</p>
        <p className="text-muted text-sm tabular-nums">
          {t("expiresIn", { time: formatCountdown(remainingMs) })}
        </p>
      </div>
      {link && (
        <a
          href={link.bot_url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(telegramButton, "h-12 text-sm")}
        >
          <Send className="size-4" aria-hidden />
          {t("openTelegram")}
        </a>
      )}
    </div>
  );
}
