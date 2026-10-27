"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Coins, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { AnimatePresence, m } from "@/components/ui/motion";
import { useAuth } from "@/hooks/useAuth";
import { consumeGuestGame, useGameAllowance } from "@/hooks/useGameAllowance";
import { ApiError } from "@/lib/api/types";
import { getGamesApi, GAME_LIMIT_REACHED, type GameTopic } from "@/lib/games/api";
import {
  FREE_GAMES_PER_MONTH,
  GAME_KEYS,
  MONTHLY_BONUS_COINS,
  type GameId,
} from "@/lib/games/config";
import { gameKeys } from "@/lib/games/queries";
import { useRouter } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { gamePlayPath } from "@/lib/utils/routes";
import { useAuthModalStore } from "@/stores/auth-modal.store";
import { useGameStore } from "@/stores/game.store";
import { AllowanceChips } from "./AllowanceChips";
import { GamePickStep } from "./GamePickStep";
import { GameSetupStep, type GameSetupResult } from "./GameSetupStep";

const TOTAL_STEPS = 2;
const iconButton =
  "text-muted hover:bg-subtle hover:text-foreground inline-flex size-11 items-center justify-center rounded-full transition-colors focus-visible:ring-4 focus-visible:ring-game-indigo/50 focus-visible:outline-none";

/** 2-qadam o'ngdan kiradi, orqaga qaytilganda 1-qadam chapdan. */
const slide = {
  enter: (direction: number) => ({ opacity: 0, x: direction * 48 }),
  center: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 420, damping: 36 } },
  exit: (direction: number) => ({ opacity: 0, x: direction * -48, transition: { duration: 0.14 } }),
} as const;

export interface GameStartModalProps {
  /** `null` — modal yopiq. */
  topic: GameTopic | null;
  /** Oldindan tanlangan o'yin (mavzu blokidagi karta bosilganda). */
  initialGame?: GameId | null;
  onClose: () => void;
}

/**
 * O'yinga kirish modali: 1) o'yin tanlash, 2) jamoalar va savollar. "O'yinni boshlash" savollarni
 * oladi, urinish sarflaydi (kirgan — server sessiyasi, mehmon — `localStorage`), holatni
 * `useGameStore` ga yozadi va o'yin sahifasiga o'tadi. Native `<dialog>`: focus trap va Esc.
 */
export function GameStartModal({ topic, initialGame = null, onClose }: GameStartModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const open = topic !== null;
  // Yopilish animatsiyasi paytida ham mavzu nomi ko'rinib tursin.
  const [shown, setShown] = useState<GameTopic | null>(topic);
  if (topic && topic !== shown) setShown(topic);

  useEffect(() => {
    const dialog = ref.current;
    if (open && dialog && !dialog.open) dialog.showModal();
  }, [open]);

  // Next `<Activity>` chiqilgan sahifani DOM'da yashirin qoldiradi (effektlar tozalanadi): ochiq
  // modal dialog qolsa, keyingi sahifa butunlay `inert` bo'lib qoladi.
  useEffect(() => {
    const dialog = ref.current;
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // Brauzer dialogni o'zi yopsa (takroriy Esc) — holat ham yopilsin.
      onClose={() => {
        if (open) onClose();
      }}
      className="font-game m-0 h-dvh max-h-none w-full max-w-none overflow-hidden bg-transparent p-0 backdrop:bg-transparent"
      data-testid="game-modal"
    >
      <AnimatePresence onExitComplete={() => ref.current?.close()}>
        {open && shown && (
          <m.div
            key="overlay"
            className="bg-overlay fixed inset-0 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.2 } }}
            exit={{ opacity: 0, transition: { duration: 0.18 } }}
            onClick={onClose}
          />
        )}
        {open && shown && (
          <m.div
            key="panel"
            className="pointer-events-none fixed inset-0 flex items-end justify-center sm:items-center sm:p-6"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              transition: { type: "spring", stiffness: 380, damping: 30 },
            }}
            exit={{ opacity: 0, y: 16, scale: 0.97, transition: { duration: 0.16 } }}
          >
            <ModalBody
              topic={shown}
              initialGame={initialGame}
              titleId={titleId}
              onClose={onClose}
            />
          </m.div>
        )}
      </AnimatePresence>
    </dialog>
  );
}

function ModalBody({
  topic,
  initialGame,
  titleId,
  onClose,
}: {
  topic: GameTopic;
  initialGame: GameId | null;
  titleId: string;
  onClose: () => void;
}) {
  const t = useTranslations("games.modal");
  const tl = useTranslations("games.list");
  const router = useRouter();
  const queryClient = useQueryClient();
  const { status } = useAuth();
  const allowance = useGameAllowance();
  const openAuth = useAuthModalStore((state) => state.openModal);
  const startGame = useGameStore((state) => state.start);

  const [step, setStep] = useState<1 | 2>(1);
  const [direction, setDirection] = useState(1);
  const [game, setGame] = useState<GameId | null>(initialGame);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [limit, setLimit] = useState(false);

  const goTo = (next: 1 | 2) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
    setError(false);
    setLimit(false);
  };

  const user = allowance.kind === "user" ? allowance.allowance : null;
  const costNote =
    user && user.free_games_left === 0 && user.coins >= user.game_cost_coins
      ? t("costNote", { cost: user.game_cost_coins })
      : null;

  const start = async ({ teamNames, questionCount }: GameSetupResult) => {
    if (!game || pending || status === "loading") return;
    const signedIn = status === "authenticated";
    if (!signedIn && allowance.kind === "guest" && allowance.guest.left <= 0) {
      setLimit(true);
      return;
    }
    setPending(true);
    setError(false);
    try {
      const api = getGamesApi();
      // Avval savollar: olinmasa urinish behuda sarflanmaydi.
      const { questions } = await api.questions(topic.slug, questionCount);
      let sessionId: string | null = null;
      if (signedIn) {
        const session = await api.startSession(game, topic.slug);
        sessionId = session.session_id;
        queryClient.setQueryData(gameKeys.allowance(), session.allowance);
      } else if (!consumeGuestGame()) {
        setLimit(true);
        return;
      }
      startGame({ game, topic, teamNames, questionCount, questions, sessionId });
      // Orqaga qaytilganda modal qayta ochilmasin.
      onClose();
      router.push(gamePlayPath(topic.slug, game));
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === GAME_LIMIT_REACHED) {
        setLimit(true);
        void queryClient.invalidateQueries({ queryKey: gameKeys.allowance() });
      } else {
        setError(true);
      }
    } finally {
      setPending(false);
    }
  };

  const signIn = () => {
    onClose();
    openAuth({ reason: "default" });
  };

  return (
    <div
      className="bg-background text-foreground pointer-events-auto flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[2rem] shadow-[0_30px_80px_-30px_rgb(15_23_42/0.55)] sm:max-h-[90dvh] sm:rounded-[2rem]"
      data-game={game ? GAME_KEYS[game] : undefined}
    >
      <header className="flex items-center gap-2 px-4 pt-4 sm:px-6 sm:pt-5">
        <button
          type="button"
          onClick={() => goTo(1)}
          aria-label={t("back")}
          className={cn(iconButton, step === 1 && "invisible")}
          tabIndex={step === 1 ? -1 : undefined}
          data-testid="game-modal-back"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </button>
        <div className="flex flex-1 flex-col items-center gap-1.5">
          <div className="flex items-center gap-1.5" aria-hidden>
            {[1, 2].map((dot) => (
              <span
                key={dot}
                className={cn(
                  "h-2.5 rounded-full transition-[width,background-color] duration-300",
                  dot === step ? "bg-game-indigo w-8" : "bg-border w-2.5",
                )}
              />
            ))}
          </div>
          <p className="text-muted text-xs font-bold tracking-wide" data-testid="game-modal-step">
            {t("step", { step, total: TOTAL_STEPS })}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label={t("close")} className={iconButton}>
          <X className="size-5" aria-hidden />
        </button>
      </header>

      <div className="overflow-x-hidden overflow-y-auto px-4 pt-3 pb-5 sm:px-8 sm:pb-8">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <m.div
            key={limit ? "limit" : step}
            custom={direction}
            variants={slide}
            initial="enter"
            animate="center"
            exit="exit"
            className="flex flex-col gap-5"
          >
            {limit ? (
              <LimitNotice
                titleId={titleId}
                guest={status !== "authenticated"}
                coins={user?.coins ?? 0}
                cost={user?.game_cost_coins ?? 0}
                onSignIn={signIn}
                onDone={onClose}
              />
            ) : step === 1 ? (
              <>
                <div className="flex flex-col items-center gap-2 text-center">
                  <h2 id={titleId} className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                    {t("pickTitle")}
                  </h2>
                  <p className="text-muted text-base">{t("pickLead", { topic: topic.title })}</p>
                  <AllowanceChips state={allowance} showBonus={false} className="justify-center" />
                </div>
                <GamePickStep selected={game} onSelect={setGame} />
                <button
                  type="button"
                  disabled={!game}
                  onClick={() => goTo(2)}
                  data-testid="game-continue"
                  className="game-press bg-game-indigo inline-flex h-14 items-center justify-center rounded-[1.125rem] px-6 text-lg font-extrabold text-white [--press-deep:var(--game-deep,var(--color-game-indigo-deep))] disabled:opacity-50 data-[ready]:bg-[var(--game-from)]"
                  data-ready={game ? "" : undefined}
                >
                  {t("continue")}
                </button>
              </>
            ) : (
              game && (
                <>
                  <div className="flex flex-col items-center gap-1 text-center">
                    <h2 id={titleId} className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                      {t("setupTitle")}
                    </h2>
                    <p className="text-muted text-base">
                      {tl(`${GAME_KEYS[game]}.name`)} · {topic.title}
                    </p>
                  </div>
                  <GameSetupStep
                    game={game}
                    questionTotal={topic.question_count}
                    pending={pending}
                    note={costNote}
                    onSubmit={(result) => void start(result)}
                  />
                  {error && (
                    <p role="alert" className="text-danger text-center text-sm font-semibold">
                      {t("startError")}
                    </p>
                  )}
                </>
              )
            )}
          </m.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Server `game_limit_reached` (yoki mehmon limiti): xato toast emas, tushunarli holat. */
function LimitNotice({
  titleId,
  guest,
  coins,
  cost,
  onSignIn,
  onDone,
}: {
  titleId: string;
  guest: boolean;
  coins: number;
  cost: number;
  onSignIn: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("games.modal");
  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center" data-testid="game-limit">
      <span className="bg-accent-soft text-accent-soft-foreground flex size-18 items-center justify-center rounded-[1.5rem]">
        <Coins className="size-9" aria-hidden />
      </span>
      <h2 id={titleId} className="text-2xl font-extrabold tracking-tight sm:text-3xl">
        {t("limitTitle")}
      </h2>
      <p className="text-muted max-w-md text-base">
        {guest
          ? t("limitGuest", { bonus: MONTHLY_BONUS_COINS })
          : t("limitText", { cost, coins, free: FREE_GAMES_PER_MONTH, bonus: MONTHLY_BONUS_COINS })}
      </p>
      <button
        type="button"
        onClick={guest ? onSignIn : onDone}
        className="game-press bg-game-indigo inline-flex h-14 min-w-48 items-center justify-center rounded-[1.125rem] px-6 text-lg font-extrabold text-white"
      >
        {guest ? t("signIn") : t("understood")}
      </button>
    </div>
  );
}
