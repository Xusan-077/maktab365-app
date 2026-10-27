"use client";

import { Coins, Gift, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/Skeleton";
import type { AllowanceState } from "@/hooks/useGameAllowance";
import { MONTHLY_BONUS_COINS } from "@/lib/games/config";
import { cn } from "@/lib/utils/cn";

const chip =
  "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold whitespace-nowrap";

/**
 * "Bepul 10 tadan N ta qoldi", tanga balansi va "Har oy 20 tanga bonus" chiplari. Qiymatlar
 * serverdan (kirgan) yoki mehmon hisobidan — `useGameAllowance`.
 */
export function AllowanceChips({
  state,
  showBonus = true,
  className,
}: {
  state: AllowanceState;
  showBonus?: boolean;
  className?: string;
}) {
  const t = useTranslations("games.allowance");

  if (state.kind === "loading") {
    return (
      <div className={cn("flex flex-wrap gap-2", className)} data-testid="allowance-loading">
        <Skeleton className="h-9 w-44 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
      </div>
    );
  }

  const free =
    state.kind === "user"
      ? { left: state.allowance.free_games_left, limit: state.allowance.free_games_limit }
      : state.kind === "guest"
        ? { left: state.guest.left, limit: state.guest.limit }
        : null;
  const coins = state.kind === "user" ? state.allowance.coins : null;

  return (
    <ul className={cn("flex flex-wrap gap-2", className)} data-testid="allowance-chips">
      {free && (
        <li
          className={cn(
            chip,
            free.left > 0
              ? "border-success-soft bg-success-soft text-success-soft-foreground"
              : "border-danger-soft bg-danger-soft text-danger-soft-foreground",
          )}
          data-testid="allowance-free"
        >
          <Gift className="size-4" aria-hidden />
          {t("freeLeft", free)}
        </li>
      )}
      {coins !== null && (
        <li className={cn(chip, "border-accent-soft bg-accent-soft text-accent-soft-foreground")}>
          <Coins className="size-4" aria-hidden />
          <span className="sr-only">{t("coinsLabel", { coins })}</span>
          <span aria-hidden>{t("coins", { coins })}</span>
        </li>
      )}
      {showBonus && (
        <li
          className={cn(chip, "border-primary-soft bg-primary-soft text-primary-soft-foreground")}
        >
          <Sparkles className="size-4" aria-hidden />
          {t("monthlyBonus", { coins: MONTHLY_BONUS_COINS })}
        </li>
      )}
    </ul>
  );
}
