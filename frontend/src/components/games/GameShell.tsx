"use client";

import { useRef, type ReactNode } from "react";
import { Maximize, Minimize, Volume2, VolumeX, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFullscreen } from "@/hooks/useFullscreen";
import { useSound } from "@/hooks/useSound";
import { GAME_KEYS, type GameId } from "@/lib/games/config";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { ROUTES } from "@/lib/utils/routes";

const CONTROL = {
  round:
    "text-game-boot size-8 rounded-full bg-white shadow-[0_2px_0_var(--color-game-brand-ring)] min-[721px]:size-10",
  dark: "bg-game-cloth h-[42px] w-[42px] rounded-[14px] text-white sm:h-12 sm:w-[52px]",
};

/**
 * O'yin ekrani qobig'i (proyektor uchun): rang `data-game` dan; ovoz, to'liq ekran va chiqish
 * tugmalari. Sarlavha har o'yinda o'zicha: `header` tugmalarni argument sifatida oladi;
 * `toolsAtBottom` — tugmalar chap pastki burchakda (Arqon tortish).
 */
export function GameShell({
  game,
  variant = "dark",
  fullscreen: withFullscreen = true,
  toolsAtBottom = false,
  exitHref = ROUTES.games,
  header,
  className,
  children,
}: {
  game: GameId;
  variant?: keyof typeof CONTROL;
  fullscreen?: boolean;
  toolsAtBottom?: boolean;
  exitHref?: string;
  header: (controls: ReactNode) => ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const t = useTranslations("games.play");
  const { muted, toggle } = useSound();
  const ref = useRef<HTMLDivElement>(null);
  const fullscreen = useFullscreen(ref);
  const control = cn(
    "focus-visible:ring-game-indigo/50 inline-flex shrink-0 items-center justify-center focus-visible:ring-4 focus-visible:outline-none",
    CONTROL[variant],
  );

  const controls = (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={!muted}
        aria-label={t("sound")}
        data-testid="game-sound"
        className={cn(control, muted && "opacity-45")}
      >
        {muted ? (
          <VolumeX className="size-5" strokeWidth={2.4} aria-hidden />
        ) : (
          <Volume2 className="size-5" strokeWidth={2.4} aria-hidden />
        )}
      </button>
      {withFullscreen && fullscreen.supported && (
        <button
          type="button"
          onClick={fullscreen.toggle}
          aria-label={fullscreen.active ? t("exitFullscreen") : t("fullscreen")}
          className={cn(control, variant === "round" && "max-[720px]:hidden")}
        >
          {fullscreen.active ? (
            <Minimize className="size-5" strokeWidth={2.4} aria-hidden />
          ) : (
            <Maximize className="size-5" strokeWidth={2.4} aria-hidden />
          )}
        </button>
      )}
      <Link href={exitHref} aria-label={t("exit")} className={control} data-testid="game-exit">
        <X className="size-5" strokeWidth={2.6} aria-hidden />
      </Link>
    </>
  );

  return (
    <div
      ref={ref}
      data-game={GAME_KEYS[game]}
      className={cn(
        "font-game bg-background text-foreground relative flex min-h-dvh flex-col overflow-x-clip font-semibold",
        className,
      )}
    >
      {header(controls)}
      {children}
      {toolsAtBottom && <div className="absolute bottom-2.5 left-2.5 flex gap-2.5">{controls}</div>}
    </div>
  );
}
