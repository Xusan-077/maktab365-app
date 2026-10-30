"use client";

import { useEffect, useId } from "react";
import { yupResolver } from "@hookform/resolvers/yup";
import { Clock, Loader2, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { useSound } from "@/hooks/useSound";
import {
  availableCounts,
  defaultTeamCount,
  estimateMinutes,
  fitQuestionCount,
  DEFAULT_QUESTION_COUNT,
  GAME_KEYS,
  GAME_TEAM_COUNTS,
  QUESTION_COUNTS,
  SECONDS_PER_QUESTION,
  TEAM_COLORS,
  TEAM_COUNTS,
  type GameId,
  type TeamCount,
} from "@/lib/games/config";
import { cn } from "@/lib/utils/cn";
import { gameSetupSchema, TEAM_NAME_MAX, type GameSetupValues } from "@/lib/validation/game-setup";

const tile =
  "flex h-20 flex-col items-center justify-center gap-1.5 rounded-[20px] border-2 transition-transform duration-150 sm:h-24 focus-visible:ring-4 focus-visible:ring-game-indigo/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-35 enabled:hover:-translate-y-[3px] motion-reduce:enabled:hover:translate-y-0";
const tileOn =
  "border-[var(--game)] bg-[var(--game-soft)] text-[var(--game-ink)] shadow-[0_4px_0_var(--game-ring)]";
const tileOff = "border-border bg-surface shadow-[0_4px_0_var(--color-border)]";
const panel = "bg-background flex flex-col gap-4 rounded-[24px] p-4 sm:p-6";
const panelHead = "flex flex-wrap items-baseline justify-between gap-2";
const panelTitle = "text-lg font-extrabold";

export interface GameSetupResult {
  teamNames: string[];
  questionCount: number;
}

/**
 * Modalning 2-qadami (RHF + Yup): jamoalar soni, nomlari, savollar soni va xulosa.
 * Bo'sh nom o'rniga standart ("Ko'k jamoa"…), mavzuda yetmaydigan savollar soni o'chiq.
 */
export function GameSetupStep({
  game,
  questionTotal,
  pending,
  onSubmit,
}: {
  game: GameId;
  /** Mavzudagi faol savollar soni. */
  questionTotal: number;
  pending: boolean;
  onSubmit: (result: GameSetupResult) => void;
}) {
  const t = useTranslations("games.modal");
  const sound = useSound();
  const formId = useId();
  const allowedTeams = GAME_TEAM_COUNTS[game];
  const defaults = TEAM_COLORS.map((color) => t(`teamDefault.${color}`));

  const { register, handleSubmit, setValue, control, formState } = useForm<GameSetupValues>({
    resolver: yupResolver(gameSetupSchema) as unknown as Resolver<GameSetupValues>,
    defaultValues: {
      teamCount: defaultTeamCount(game),
      teamNames: defaults,
      questionCount: fitQuestionCount(DEFAULT_QUESTION_COUNT, questionTotal),
    },
  });
  const teamCount = useWatch({ control, name: "teamCount" }) as TeamCount;
  const questionCount = useWatch({ control, name: "questionCount" });

  // O'yin almashsa (orqaga qaytib), jamoa soni shu o'yinga mos bo'lsin.
  useEffect(() => {
    if (!allowedTeams.includes(teamCount)) setValue("teamCount", defaultTeamCount(game));
  }, [allowedTeams, teamCount, game, setValue]);

  const counts = availableCounts(questionTotal);
  const submit = handleSubmit((values) =>
    onSubmit({
      teamNames: Array.from(
        { length: values.teamCount },
        (_, index) => values.teamNames[index]?.trim() || defaults[index],
      ),
      questionCount: values.questionCount,
    }),
  );

  return (
    <form
      id={formId}
      onSubmit={submit}
      noValidate
      data-game={GAME_KEYS[game]}
      data-testid="game-setup"
    >
      <div className="mt-7 grid gap-6 sm:grid-cols-2">
        <fieldset className={panel}>
          <div className={panelHead}>
            <legend className={cn(panelTitle, "float-left")}>{t("teams")}</legend>
            {allowedTeams.length === 1 && (
              <span className="text-game-ok-ink text-[13px]" data-testid="rope-only-two">
                {t("ropeOnlyTwo")}
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {TEAM_COUNTS.map((count) => {
              const allowed = allowedTeams.includes(count);
              const active = teamCount === count;
              return (
                <button
                  key={count}
                  type="button"
                  aria-pressed={active}
                  aria-label={t("teamsOption", { count })}
                  disabled={!allowed}
                  onClick={() => {
                    sound.play("tap");
                    setValue("teamCount", count, { shouldDirty: true });
                  }}
                  data-testid={`teams-${count}`}
                  className={cn(tile, active ? tileOn : tileOff)}
                >
                  <span className="text-[30px] leading-none font-extrabold">{count}</span>
                  <span className="flex gap-1" aria-hidden>
                    {TEAM_COLORS.slice(0, count).map((color) => (
                      <span
                        key={color}
                        data-team={color}
                        className="size-2.5 rounded-full bg-[var(--team)]"
                      />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-col gap-2">
            {TEAM_COLORS.slice(0, teamCount).map((color, index) => {
              const error = formState.errors.teamNames?.[index]?.message;
              return (
                <div key={color} data-team={color} className="flex flex-col gap-1">
                  <div className="game-anim-step flex items-center gap-2.5 [animation-duration:.3s]">
                    <span
                      aria-hidden
                      className="flex size-9 flex-none items-center justify-center rounded-[12px] bg-[var(--team)] font-extrabold text-white"
                    >
                      {index + 1}
                    </span>
                    <input
                      {...register(`teamNames.${index}`)}
                      aria-label={t("teamNameLabel", { n: index + 1 })}
                      aria-invalid={error ? true : undefined}
                      placeholder={defaults[index]}
                      maxLength={TEAM_NAME_MAX + 10}
                      autoComplete="off"
                      data-testid={`team-name-${index}`}
                      className="border-border bg-surface text-foreground h-[46px] min-w-0 flex-1 rounded-[12px] border-[1.5px] px-3.5 text-[15px] font-semibold outline-none focus:border-[var(--game)]"
                    />
                  </div>
                  {error && (
                    <p className="text-game-err-dark text-sm" role="alert">
                      {t(`errors.${error}`, { max: TEAM_NAME_MAX })}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>

        <fieldset className={panel}>
          <div className={panelHead}>
            <legend className={cn(panelTitle, "float-left")}>{t("questions")}</legend>
            <span className="text-muted text-[13px]">
              {t("notEnough", { count: questionTotal })}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {QUESTION_COUNTS.map((count) => {
              const allowed = counts.includes(count);
              const active = questionCount === count;
              return (
                <button
                  key={count}
                  type="button"
                  aria-pressed={active}
                  disabled={!allowed}
                  onClick={() => {
                    sound.play("tap");
                    setValue("questionCount", count, { shouldDirty: true });
                  }}
                  data-testid={`questions-${count}`}
                  className={cn(tile, active ? tileOn : tileOff)}
                >
                  <span className="text-[30px] leading-none font-extrabold">{count}</span>
                  <span className="text-xs whitespace-nowrap opacity-80">
                    {t("minutes", { minutes: estimateMinutes(count) })}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="border-border bg-surface mt-auto flex items-center gap-3 rounded-[16px] border px-4 py-3.5 text-sm leading-[1.4] text-[var(--game-text-2)]">
            <Clock className="text-game-indigo size-[22px] flex-none" aria-hidden />
            <span data-testid="game-summary" aria-live="polite">
              {t("summary", {
                teams: teamCount,
                questions: questionCount,
                seconds: SECONDS_PER_QUESTION,
                minutes: estimateMinutes(questionCount),
              })}
            </span>
          </div>
        </fieldset>
      </div>

      <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
        <p className="text-muted text-[13px]" data-testid="game-setup-note">
          {t("teamsNote")}
        </p>
        <button
          type="submit"
          disabled={pending}
          data-testid="game-start"
          className="game-press focus-visible:ring-game-indigo/50 inline-flex h-[58px] items-center justify-center gap-2.5 rounded-[18px] bg-[var(--game)] px-8 text-lg font-extrabold text-white [--press-deep:var(--game-deep)] focus-visible:ring-4 focus-visible:outline-none disabled:opacity-70 max-sm:w-full"
        >
          {pending ? (
            <Loader2 className="size-5 animate-spin" aria-hidden />
          ) : (
            <Play className="size-5" fill="currentColor" strokeWidth={0} aria-hidden />
          )}
          {pending ? t("starting") : t("start")}
        </button>
      </div>
    </form>
  );
}
