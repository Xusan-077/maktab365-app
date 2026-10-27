import { Cable, Gift, LoaderPinwheel, type LucideIcon } from "lucide-react";
import { GAME_KEYS, type GameId } from "@/lib/games/config";
import { cn } from "@/lib/utils/cn";

const ICONS: Record<GameId, LucideIcon> = {
  "sirli-quti": Gift,
  "omad-charhi": LoaderPinwheel,
  "arqon-tortish": Cable,
};

const SIZES = {
  sm: { box: "size-9 rounded-xl", icon: "size-[1.125rem]" },
  md: { box: "size-14 rounded-[1.125rem]", icon: "size-7" },
  lg: { box: "size-[4.5rem] rounded-[1.375rem]", icon: "size-9" },
} as const;

/** O'yinning gradientli ikonkasi (rang `data-game` dan). Bezak — yonidagi matn nomni aytadi. */
export function GameIcon({
  game,
  size = "md",
  float = false,
  className,
}: {
  game: GameId;
  size?: keyof typeof SIZES;
  /** Sekin suzib turadi (`prefers-reduced-motion` da o'chadi). */
  float?: boolean;
  className?: string;
}) {
  const Icon = ICONS[game];
  return (
    <span
      aria-hidden
      data-game={GAME_KEYS[game]}
      className={cn(
        "inline-flex shrink-0 items-center justify-center bg-[linear-gradient(135deg,var(--game-from),var(--game-to))] text-white shadow-[0_6px_16px_-6px_var(--game-deep)]",
        SIZES[size].box,
        float && "game-float",
        className,
      )}
    >
      <Icon className={SIZES[size].icon} strokeWidth={2.25} />
    </span>
  );
}
