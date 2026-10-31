"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCountdown } from "@/hooks/useCountdown";
import { getGamesApi, type GameQuestion } from "@/lib/games/api";
import type { AnswerState } from "./AnswerOption";

/** Klaviatura: 1–4 yoki A–D (faqat lotin harflari). */
export function keyToOption(key: string): number | null {
  const digit = "1234".indexOf(key);
  if (digit !== -1) return digit;
  const letter = "abcd".indexOf(key.toLowerCase());
  return letter === -1 || key.length !== 1 ? null : letter;
}

export type RoundOutcome =
  | { kind: "answered"; correct: boolean; selected: string; correctOptionId: string }
  | { kind: "timeout" };

interface Options {
  question: GameQuestion;
  /** Savol taymeri (soniya); `null` — taymersiz (arqon tortishda umumiy taymer). */
  seconds: number | null;
  /** Bir marta chaqiriladi: to'g'ri/xato yoki vaqt tugashi (`false`); `ms` — javobgacha o'tgan vaqt. */
  onResolved: (correct: boolean, ms: number) => void;
  /** Klaviatura → variant indeksi; `null` — klaviatura o'chiq. */
  keyMap?: ((key: string) => number | null) | null;
  /** Masalan, arqonda blok paytida yoki o'yin tugaganda. */
  disabled?: boolean;
}

/**
 * Bitta savol raundi: javob serverda `answer_token` bilan tekshiriladi, taymer, klaviatura.
 * Uchala o'yin sahnasi (quti modali, charx paneli, arqon panellari) shu hook'dan foydalanadi.
 */
export function useQuestionRound({
  question,
  seconds,
  onResolved,
  keyMap = keyToOption,
  disabled = false,
}: Options) {
  const [checking, setChecking] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<RoundOutcome | null>(null);
  const [error, setError] = useState(false);
  // Javob bir marta hisoblanadi (taymer va tekshiruv javobi bir vaqtda kelsa ham).
  const settled = useRef(false);
  const shownAt = useRef(0);
  useEffect(() => {
    shownAt.current = Date.now();
  }, [question]);
  const resolved = useRef(onResolved);
  useEffect(() => {
    resolved.current = onResolved;
  });

  const expire = useCallback(() => {
    if (settled.current) return;
    settled.current = true;
    resolved.current(false, Date.now() - shownAt.current);
    setOutcome({ kind: "timeout" });
  }, []);
  const remaining = useCountdown(
    seconds ?? 0,
    seconds !== null && outcome === null && checking === null && !disabled,
    expire,
  );

  const choose = useCallback(
    async (index: number) => {
      const option = question.options[index];
      if (!option || outcome || checking || disabled || settled.current) return;
      setChecking(option.id);
      setError(false);
      try {
        const result = await getGamesApi().check(question.answer_token, option.id);
        if (settled.current) return;
        settled.current = true;
        resolved.current(result.correct, Date.now() - shownAt.current);
        setOutcome({
          kind: "answered",
          correct: result.correct,
          selected: option.id,
          correctOptionId: result.correct_option_id,
        });
      } catch {
        setError(true);
      } finally {
        setChecking(null);
      }
    },
    [question, outcome, checking, disabled],
  );

  useEffect(() => {
    if (!keyMap) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || outcome) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;
      const index = keyMap(event.key);
      if (index === null) return;
      event.preventDefault();
      void choose(index);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choose, outcome, keyMap]);

  const stateOf = (optionId: string): AnswerState => {
    if (!outcome) return checking === optionId ? "selected" : "idle";
    if (outcome.kind === "timeout") return "dim";
    if (optionId === outcome.correctOptionId) return "correct";
    if (optionId === outcome.selected) return "wrong";
    return "dim";
  };
  const correctIndex =
    outcome?.kind === "answered"
      ? question.options.findIndex((option) => option.id === outcome.correctOptionId)
      : -1;

  return {
    remaining,
    outcome,
    error,
    choose,
    stateOf,
    correctIndex,
    locked: outcome !== null || checking !== null || disabled,
  };
}
