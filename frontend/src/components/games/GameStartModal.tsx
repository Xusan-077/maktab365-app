"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Info, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/hooks/useAuth";
import { useSound } from "@/hooks/useSound";
import { getGamesApi, type GameTopic } from "@/lib/games/api";
import { GAME_IDS, GAME_KEYS, type GameId } from "@/lib/games/config";
import { useRouter } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { gamePlayPath } from "@/lib/utils/routes";
import { useGameStore } from "@/stores/game.store";
import { primaryButton } from "./AnswerFeedback";
import { GameIcon } from "./GameIcon";
import { GamePickStep } from "./GamePickStep";
import { GameSetupStep, type GameSetupResult } from "./GameSetupStep";

const TOTAL_STEPS = 2;
const iconButton =
  "bg-subtle text-foreground hover:bg-border inline-flex size-11 items-center justify-center rounded-[14px] transition-colors focus-visible:ring-4 focus-visible:ring-game-indigo/50 focus-visible:outline-none";

export interface GameStartModalProps {
  /** `null` — modal yopiq. */
  topic: GameTopic | null;
  /** Oldindan tanlangan o'yin (mavzu kartasi yoki blokidagi tugma bosilganda). */
  initialGame?: GameId | null;
  onClose: () => void;
}

/**
 * O'yinga kirish modali: 1) o'yin tanlash, 2) jamoalar va savollar. "O'yinni boshlash" savollarni
 * oladi, kirgan foydalanuvchiga statistika sessiyasini ochadi, holatni `useGameStore` ga yozadi
 * va o'yin sahifasiga o'tadi. Native `<dialog>`: focus trap va Esc.
 */
export function GameStartModal({ topic, initialGame = null, onClose }: GameStartModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const open = topic !== null;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
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
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className={cn(
        "font-game m-0 h-dvh max-h-none w-full max-w-none items-center justify-center overflow-hidden bg-transparent p-0 backdrop:bg-transparent",
        open && "game-anim-fade flex bg-[rgb(15_23_42/0.6)] sm:p-5",
      )}
      data-testid="game-modal"
    >
      {topic && (
        <ModalBody
          key={topic.id}
          topic={topic}
          initialGame={initialGame}
          titleId={titleId}
          onClose={onClose}
        />
      )}
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
  const { play } = useSound();
  const router = useRouter();
  const { status } = useAuth();
  const startGame = useGameStore((state) => state.start);

  const [step, setStep] = useState<1 | 2>(1);
  const [back, setBack] = useState(false);
  const [game, setGame] = useState<GameId>(initialGame ?? GAME_IDS[0]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => play("open"), [play]);

  const goTo = (next: 1 | 2) => {
    play("tap");
    setBack(next < step);
    setStep(next);
    setError(false);
  };

  const start = async ({ teamNames, questionCount }: GameSetupResult) => {
    if (pending || status === "loading") return;
    setPending(true);
    setError(false);
    try {
      const api = getGamesApi();
      const { questions } = await api.questions(topic.slug, questionCount);
      // Sessiya faqat statistika uchun: yozilmasa ham o'yin boshlanadi.
      const sessionId =
        status === "authenticated"
          ? await api.startSession(game, topic.slug).then(
              (session) => session.session_id,
              () => null,
            )
          : null;
      startGame({ game, topic, teamNames, questionCount, questions, sessionId });
      // Orqaga qaytilganda modal qayta ochilmasin.
      onClose();
      router.push(gamePlayPath(topic.slug, game));
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      className="game-anim-modal bg-surface text-foreground max-h-full w-full max-w-[960px] overflow-x-hidden overflow-y-auto p-5 font-semibold shadow-[0_24px_60px_rgb(15_23_42/0.25)] sm:max-h-[calc(100dvh-40px)] sm:rounded-[32px] sm:px-9 sm:py-8"
      data-game={GAME_KEYS[game]}
    >
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => goTo(1)}
            aria-label={t("back")}
            className={cn(iconButton, step === 1 && "hidden")}
            data-testid="game-modal-back"
          >
            <ArrowLeft className="size-5" strokeWidth={2.6} aria-hidden />
          </button>
          <span className="flex gap-1.5" aria-hidden>
            {[1, 2].map((dot) => (
              <span
                key={dot}
                className={cn(
                  "h-2.5 rounded-full transition-[width,background-color] duration-300",
                  dot === step ? "bg-game-indigo w-7" : "bg-border w-2.5",
                )}
              />
            ))}
          </span>
          <p className="text-muted text-sm" data-testid="game-modal-step">
            {t("step", { step, total: TOTAL_STEPS })}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label={t("close")} className={iconButton}>
          <X className="size-5" strokeWidth={2.6} aria-hidden />
        </button>
      </header>

      <div key={step} className={back ? "game-anim-step-back" : "game-anim-step"}>
        {step === 1 ? (
          <>
            <h2
              id={titleId}
              className="text-center text-[26px] font-extrabold tracking-[-0.8px] sm:text-[34px]"
            >
              {t("pickTitle")}
            </h2>
            <div className="mt-3 flex justify-center">
              <span className="bg-game-banner text-game-brand-ink rounded-full px-3.5 py-1.5 text-sm font-bold">
                {t("pickLead", { topic: topic.title })}
              </span>
            </div>
            <GamePickStep
              selected={game}
              onSelect={(next) => {
                play("tap");
                setGame(next);
              }}
            />
            <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
              <p className="text-muted flex items-center gap-2 text-sm">
                <Info className="size-[18px] shrink-0" aria-hidden />
                {t("pickNote")}
              </p>
              <button
                type="button"
                onClick={() => goTo(2)}
                data-testid="game-continue"
                className={cn(primaryButton, "max-sm:w-full")}
              >
                {t("continue")}
                <ArrowRight className="size-5" strokeWidth={2.6} aria-hidden />
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-center gap-3.5">
              <GameIcon game={game} />
              <h2
                id={titleId}
                className="text-[26px] font-extrabold tracking-[-0.8px] sm:text-[34px]"
              >
                {tl(`${GAME_KEYS[game]}.name`)}
              </h2>
            </div>
            <p className="text-muted mt-2 text-center text-base">{t("setupLead")}</p>
            <GameSetupStep
              game={game}
              questionTotal={topic.question_count}
              pending={pending}
              onSubmit={(result) => void start(result)}
            />
            {error && (
              <p role="alert" className="text-game-err-dark mt-3 text-center text-sm font-semibold">
                {t("startError")}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
