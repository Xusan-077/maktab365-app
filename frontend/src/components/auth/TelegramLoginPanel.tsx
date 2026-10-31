"use client";

import { useEffect, useRef } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useTranslations } from "next-intl";
import { AuthDivider } from "@/components/auth/AuthDivider";
import { TelegramIcon } from "@/components/login/TelegramIcon";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuthErrorText } from "@/hooks/useAuthErrorText";
import { useTelegramLogin } from "@/hooks/useTelegramLogin";
import { formatCountdown } from "@/lib/auth/telegram-login";
import { cn } from "@/lib/utils/cn";

const telegramButton =
  "bg-telegram inline-flex h-13 w-full items-center justify-center gap-2.5 rounded-xl px-5 text-base font-semibold text-white transition-[filter,transform] hover:brightness-95 motion-safe:active:scale-[0.98] disabled:opacity-70";

const QR_SIZE = 176;

/**
 * Telegram orqali kirish — ikki yo'l, bitta bir martalik havola: (1) QR kod (doim ko'rinadi; boshqa
 * qurilmadagi Telegram bilan skanerlanadi), (2) "Telegram bilan kirish" — botni yangi oynada/ilovada
 * ochadi. Ikkalasida ham botda Start bosilgach shu sahifa o'zi kiradi (holat polling'i). Havola
 * panel ochilishi bilan olinadi; muddat tugasa yoki xato bo'lsa QR ustida "Qayta urinish".
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
  const { phase, error, link, remainingMs, start, retry } = useTelegramLogin({
    onSignedIn,
    withPhone: process.env.NEXT_PUBLIC_TELEGRAM_REQUIRE_PHONE === "1",
  });
  const started = useRef(false);

  useEffect(() => {
    // StrictMode'da effekt ikki marta ishlaydi — havola bir marta olinsin.
    if (started.current) return;
    started.current = true;
    start();
  }, [start]);

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

  const failed = phase === "expired" || phase === "error";
  const ready = phase === "pending" && link !== null;

  return (
    <div className={cn("flex flex-col items-center gap-4 text-center", className)}>
      <div className="flex flex-col items-center gap-2">
        <div
          className="border-border relative rounded-xl border bg-white p-3"
          data-testid="telegram-qr"
        >
          {link && phase !== "starting" ? (
            <QRCodeSVG
              value={link.bot_url}
              size={QR_SIZE}
              marginSize={0}
              title={t("qrTitle")}
              className={cn(failed && "opacity-15 blur-[2px]")}
            />
          ) : failed ? (
            <div style={{ width: QR_SIZE, height: QR_SIZE }} />
          ) : (
            <Skeleton style={{ width: QR_SIZE, height: QR_SIZE }} />
          )}
          {failed && (
            <button
              type="button"
              onClick={retry}
              className="text-foreground absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl text-sm font-semibold"
            >
              <RefreshCw className="size-6" aria-hidden />
              {t("retry")}
            </button>
          )}
        </div>
        <div role="status" aria-live="polite" className="flex flex-col gap-0.5">
          {phase === "error" ? (
            <p role="alert" className="text-danger text-sm">
              {errorText(error ?? "unknown")}
            </p>
          ) : phase === "expired" ? (
            <p className="text-muted text-sm">{t("expired")}</p>
          ) : (
            <>
              <p className="text-sm font-medium">{t("qrHint")}</p>
              {ready && (
                <p className="text-muted text-xs tabular-nums">
                  {t("expiresIn", { time: formatCountdown(remainingMs) })}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <div className="w-full">
        <AuthDivider />
      </div>

      <div className="flex w-full flex-col gap-2">
        {ready ? (
          <a
            href={link.bot_url}
            target="_blank"
            rel="noopener noreferrer"
            className={telegramButton}
            data-testid="telegram-bot-login"
          >
            <TelegramIcon inverted className="size-6" />
            {t("start")}
          </a>
        ) : (
          <button
            type="button"
            onClick={failed ? retry : undefined}
            disabled={!failed}
            aria-busy={phase === "starting" || undefined}
            className={telegramButton}
            data-testid="telegram-bot-login"
          >
            {phase === "starting" || phase === "idle" ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : (
              <TelegramIcon inverted className="size-6" />
            )}
            {t("start")}
          </button>
        )}
        <p className="text-muted text-xs">{t("botHint")}</p>
      </div>
    </div>
  );
}
