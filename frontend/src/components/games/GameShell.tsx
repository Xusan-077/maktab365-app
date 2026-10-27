"use client";

import { useRef, type ReactNode } from "react";
import { LogOut, Maximize, Minimize, Volume2, VolumeX } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFullscreen } from "@/hooks/useFullscreen";
import { GAME_KEYS, type GameId } from "@/lib/games/config";
import { Link } from "@/lib/i18n/navigation";
import { ROUTES } from "@/lib/utils/routes";
import { GameIcon } from "./GameIcon";

const control =
  "border-border bg-surface text-foreground hover:bg-subtle inline-flex size-11 shrink-0 items-center sm:size-12 justify-center rounded-[1rem] border-2 transition-colors focus-visible:ring-4 focus-visible:ring-game-indigo/50 focus-visible:outline-none";

/**
 * O'yin ekrani qobig'i (proyektor uchun): o'yin nomi va mavzu, ovoz on/off, to'liq ekran, chiqish.
 * Rang `data-game` dan; ichidagi barcha o'yin komponentlari `var(--game-*)` ni oladi.
 */
export function GameShell({
  game,
  title,
  subtitle,
  sound,
  exitHref = ROUTES.games,
  children,
}: {
  game: GameId;
  title: string;
  subtitle?: string;
  sound?: { enabled: boolean; toggle: () => void };
  exitHref?: string;
  children: ReactNode;
}) {
  const t = useTranslations("games.play");
  const ref = useRef<HTMLDivElement>(null);
  const fullscreen = useFullscreen(ref);

  return (
    <div
      ref={ref}
      data-game={GAME_KEYS[game]}
      className="font-game bg-background text-foreground flex min-h-dvh flex-col bg-[radial-gradient(ellipse_at_top,color-mix(in_srgb,var(--game-from)_14%,transparent),transparent_60%)]"
    >
      <header className="flex items-center gap-2 px-4 py-3 sm:gap-3 sm:px-8 sm:py-4">
        <GameIcon game={game} size="md" className="max-sm:hidden" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-extrabold sm:text-xl">{title}</p>
          {subtitle && <p className="text-muted truncate text-sm sm:text-base">{subtitle}</p>}
        </div>
        {sound && (
          <button
            type="button"
            onClick={sound.toggle}
            aria-pressed={sound.enabled}
            aria-label={sound.enabled ? t("soundOff") : t("soundOn")}
            className={control}
          >
            {sound.enabled ? (
              <Volume2 className="size-6" aria-hidden />
            ) : (
              <VolumeX className="size-6" aria-hidden />
            )}
          </button>
        )}
        {fullscreen.supported && (
          <button
            type="button"
            onClick={fullscreen.toggle}
            aria-label={fullscreen.active ? t("exitFullscreen") : t("fullscreen")}
            className={control}
          >
            {fullscreen.active ? (
              <Minimize className="size-6" aria-hidden />
            ) : (
              <Maximize className="size-6" aria-hidden />
            )}
          </button>
        )}
        <Link href={exitHref} aria-label={t("exit")} className={control} data-testid="game-exit">
          <LogOut className="size-6" aria-hidden />
        </Link>
      </header>
      <div className="flex flex-1 flex-col px-4 pb-6 sm:px-8 sm:pb-10">{children}</div>
    </div>
  );
}
