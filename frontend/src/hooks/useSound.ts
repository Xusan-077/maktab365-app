"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SoundName = "correct" | "wrong" | "tick";

/** Oddiy WebAudio ohanglari (fayl yuklanmaydi): [chastota Hz, boshlanish s, davomiylik s]. */
const TONES: Record<SoundName, { type: OscillatorType; notes: [number, number, number][] }> = {
  correct: {
    type: "triangle",
    notes: [
      [523.25, 0, 0.12],
      [659.25, 0.1, 0.12],
      [783.99, 0.2, 0.22],
    ],
  },
  wrong: {
    type: "sawtooth",
    notes: [
      [220, 0, 0.18],
      [174.61, 0.16, 0.28],
    ],
  },
  tick: { type: "sine", notes: [[880, 0, 0.05]] },
};
const VOLUME = 0.18;
const STORAGE_KEY = "maktab365-game-sound";

function readEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

/**
 * O'yin ovozlari: `play("correct")`. Yoqilgan/o'chirilgani `localStorage` da eslab qolinadi.
 * `AudioContext` birinchi chalishda (foydalanuvchi bosgandan keyin) yaratiladi — brauzer autoplay qoidasi.
 */
export function useSound() {
  const [enabled, setEnabled] = useState(true);
  const context = useRef<AudioContext | null>(null);

  // localStorage faqat mount'dan keyin (SSR bilan bir xil birinchi render).
  // eslint-disable-next-line react-hooks/set-state-in-effect -- tashqi saqlash bilan sinxronlash
  useEffect(() => setEnabled(readEnabled()), []);
  useEffect(() => () => void context.current?.close(), []);

  const toggle = useCallback(() => {
    setEnabled((value) => {
      try {
        localStorage.setItem(STORAGE_KEY, value ? "off" : "on");
      } catch {
        // saqlab bo'lmasa ham shu sahifada ishlaydi
      }
      return !value;
    });
  }, []);

  const play = useCallback(
    (name: SoundName) => {
      if (!enabled || typeof window === "undefined" || !("AudioContext" in window)) return;
      context.current ??= new AudioContext();
      const audio = context.current;
      if (audio.state === "suspended") void audio.resume();
      const { type, notes } = TONES[name];
      const now = audio.currentTime;
      for (const [frequency, start, duration] of notes) {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.type = type;
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, now + start);
        gain.gain.exponentialRampToValueAtTime(VOLUME, now + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);
        oscillator.connect(gain).connect(audio.destination);
        oscillator.start(now + start);
        oscillator.stop(now + start + duration + 0.02);
      }
    },
    [enabled],
  );

  return { enabled, toggle, play };
}
