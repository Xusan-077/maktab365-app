"use client";

import { useEffect, useId } from "react";
import { yupResolver } from "@hookform/resolvers/yup";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForm, useWatch, type Resolver } from "react-hook-form";
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
  "flex flex-col items-center justify-center gap-1.5 rounded-[1.25rem] border-[3px] bg-surface px-3 py-3 font-extrabold transition-[border-color,background-color,opacity] focus-visible:ring-4 focus-visible:ring-game-indigo/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40";
const tileOn =
  "border-[var(--game-from)] bg-[color-mix(in_srgb,var(--game-from)_8%,var(--color-surface))]";
const tileOff =
  "border-border hover:border-[color-mix(in_srgb,var(--game-from)_40%,var(--color-border))]";

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
  note,
  onSubmit,
}: {
  game: GameId;
  /** Mavzudagi faol savollar soni. */
  questionTotal: number;
  pending: boolean;
  /** Boshlash tugmasi ustidagi izoh (masalan, tanga yechilishi). */
  note?: string | null;
  onSubmit: (result: GameSetupResult) => void;
}) {
  const t = useTranslations("games.modal");
  const formId = useId();
  const allowedTeams = GAME_TEAM_COUNTS[game];
  const defaults = TEAM_COLORS.map((color) => t(`teamDefault.${color}`));

  const { register, handleSubmit, setValue, control, formState } = useForm<GameSetupValues>({
    resolver: yupResolver(gameSetupSchema) as unknown as Resolver<GameSetupValues>,
    defaultValues: {
      teamCount: defaultTeamCount(game),
      teamNames: ["", "", ""],
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
      className="flex flex-col gap-6"
      data-testid="game-setup"
    >
      <fieldset className="flex flex-col gap-3">
        <legend className="text-foreground mb-3 text-base font-bold">{t("teams")}</legend>
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          {TEAM_COUNTS.map((count) => {
            const allowed = allowedTeams.includes(count);
            const active = teamCount === count;
            return (
              <button
                key={count}
                type="button"
                aria-pressed={active}
                disabled={!allowed}
                onClick={() => setValue("teamCount", count, { shouldDirty: true })}
                data-testid={`teams-${count}`}
                className={cn(tile, "min-h-24 text-2xl", active ? tileOn : tileOff)}
              >
                <span className="flex gap-1" aria-hidden>
                  {TEAM_COLORS.slice(0, count).map((color) => (
                    <span
                      key={color}
                      data-team={color}
                      className="size-3 rounded-full bg-[var(--team)]"
                    />
                  ))}
                </span>
                <span className="text-foreground text-base sm:text-lg">
                  {t("teamsOption", { count })}
                </span>
              </button>
            );
          })}
        </div>
        {allowedTeams.length === 1 && (
          <p className="text-muted text-sm font-semibold" data-testid="rope-only-two">
            {t("ropeOnlyTwo")}
          </p>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-2.5">
        <legend className="text-foreground mb-3 text-base font-bold">{t("teamNames")}</legend>
        {TEAM_COLORS.slice(0, teamCount).map((color, index) => {
          const error = formState.errors.teamNames?.[index]?.message;
          return (
            <div key={color} data-team={color} className="flex flex-col gap-1">
              <div className="border-input-border bg-surface flex h-13 items-center gap-3 rounded-[1rem] border-2 px-4 focus-within:border-[var(--team)] focus-within:ring-4 focus-within:ring-[color-mix(in_srgb,var(--team)_25%,transparent)]">
                <span aria-hidden className="size-3.5 shrink-0 rounded-full bg-[var(--team)]" />
                <input
                  {...register(`teamNames.${index}`)}
                  aria-label={t("teamNameLabel", { n: index + 1 })}
                  aria-invalid={error ? true : undefined}
                  placeholder={defaults[index]}
                  maxLength={TEAM_NAME_MAX + 10}
                  autoComplete="off"
                  data-testid={`team-name-${index}`}
                  className="text-foreground placeholder:text-placeholder h-full min-w-0 flex-1 bg-transparent text-base font-semibold outline-none"
                />
              </div>
              {error && (
                <p className="text-danger text-sm" role="alert">
                  {t(`errors.${error}`, { max: TEAM_NAME_MAX })}
                </p>
              )}
            </div>
          );
        })}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-foreground mb-3 text-base font-bold">{t("questions")}</legend>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
          {QUESTION_COUNTS.map((count) => {
            const allowed = counts.includes(count);
            const active = questionCount === count;
            return (
              <button
                key={count}
                type="button"
                aria-pressed={active}
                disabled={!allowed}
                onClick={() => setValue("questionCount", count, { shouldDirty: true })}
                data-testid={`questions-${count}`}
                className={cn(tile, "min-h-20", active ? tileOn : tileOff)}
              >
                <span className="text-foreground text-2xl">{t("questionsOption", { count })}</span>
                <span className="text-muted text-xs font-semibold">
                  {t("minutes", { minutes: estimateMinutes(count) })}
                </span>
              </button>
            );
          })}
        </div>
        {counts.length < QUESTION_COUNTS.length && (
          <p className="text-muted text-sm font-semibold">
            {t("notEnough", { count: questionTotal })}
          </p>
        )}
      </fieldset>

      <div className="flex flex-col gap-3">
        <p
          className="bg-subtle text-foreground rounded-[1rem] px-4 py-3 text-center text-sm font-semibold sm:text-base"
          data-testid="game-summary"
          aria-live="polite"
        >
          {t("summary", {
            teams: teamCount,
            questions: questionCount,
            seconds: SECONDS_PER_QUESTION,
            minutes: estimateMinutes(questionCount),
          })}
        </p>
        {note && (
          <p className="text-accent-soft-foreground bg-accent-soft rounded-[1rem] px-4 py-2.5 text-sm font-semibold">
            {note}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          data-game={GAME_KEYS[game]}
          data-testid="game-start"
          className="game-press inline-flex h-14 items-center justify-center gap-2 rounded-[1.125rem] bg-[var(--game-from)] px-6 text-lg font-extrabold text-white [--press-deep:var(--game-deep)] disabled:opacity-70"
        >
          {pending && <Loader2 className="size-5 animate-spin" aria-hidden />}
          {pending ? t("starting") : t("start")}
        </button>
      </div>
    </form>
  );
}
