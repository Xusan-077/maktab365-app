"use client";

import { useEffect, useSyncExternalStore } from "react";

export type SoundName =
  | "tap"
  | "open"
  | "correct"
  | "wrong"
  | "tick"
  | "land"
  | "bonus"
  | "bomb"
  | "pull"
  | "beep"
  | "win";

export const SOUND_STORAGE_KEY = "d365-sound";
const VOLUME = 0.35;

interface ToneOptions {
  type?: OscillatorType;
  vol?: number;
  to?: number;
}

let audio: AudioContext | null = null;
let muted: boolean | null = null;
const listeners = new Set<() => void>();

function isMuted(): boolean {
  if (muted === null) {
    try {
      muted = localStorage.getItem(SOUND_STORAGE_KEY) === "off";
    } catch {
      muted = false;
    }
  }
  return muted;
}

function context(): AudioContext | null {
  if (!audio) {
    const Context =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return null;
    audio = new Context();
  }
  if (audio.state === "suspended") void audio.resume();
  return audio;
}

function tone(
  ctx: AudioContext,
  frequency: number,
  start: number,
  duration: number,
  { type = "sine", vol = 1, to }: ToneOptions = {},
) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  const at = ctx.currentTime + start;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, at);
  if (to) oscillator.frequency.exponentialRampToValueAtTime(to, at + duration);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(VOLUME * vol, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(at);
  oscillator.stop(at + duration + 0.02);
}

function noise(ctx: AudioContext, start: number, duration: number, vol = 1) {
  const length = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < length; index++) {
    data[index] = (Math.random() * 2 - 1) * (1 - index / length);
  }
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 900;
  source.buffer = buffer;
  gain.gain.value = VOLUME * vol;
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start(ctx.currentTime + start);
}

/** Fayllarsiz WebAudio sintezi: `design/games/shared.js` dagi `D365.sound` bilan 1 ga 1. */
function play(name: SoundName): void {
  if (isMuted()) return;
  const ctx = context();
  if (!ctx) return;
  const T = (frequency: number, start: number, duration: number, options?: ToneOptions) =>
    tone(ctx, frequency, start, duration, options);
  switch (name) {
    case "tap":
      T(620, 0, 0.06, { type: "triangle", vol: 0.5 });
      break;
    case "open":
      T(320, 0, 0.18, { type: "triangle", vol: 0.6, to: 880 });
      break;
    case "correct":
      T(659, 0, 0.12, { type: "triangle" });
      T(988, 0.1, 0.22, { type: "triangle" });
      break;
    case "wrong":
      T(233, 0, 0.16, { type: "square", vol: 0.35 });
      T(175, 0.14, 0.26, { type: "square", vol: 0.35 });
      break;
    case "tick":
      T(1500, 0, 0.025, { type: "square", vol: 0.18 });
      break;
    case "land":
      T(523, 0, 0.1, { type: "triangle" });
      T(784, 0.08, 0.18, { type: "triangle" });
      break;
    case "bonus":
      [784, 988, 1175, 1568].forEach((frequency, index) =>
        T(frequency, index * 0.07, 0.16, { type: "triangle", vol: 0.8 }),
      );
      break;
    case "bomb":
      noise(ctx, 0, 0.45, 1.2);
      T(140, 0, 0.45, { vol: 1, to: 45 });
      break;
    case "pull":
      T(160, 0, 0.16, { vol: 1, to: 70 });
      noise(ctx, 0, 0.08, 0.5);
      T(880, 0.08, 0.14, { type: "triangle", vol: 0.6 });
      break;
    case "beep":
      T(880, 0, 0.09, { type: "sine", vol: 0.6 });
      break;
    case "win":
      [523, 659, 784].forEach((frequency, index) =>
        T(frequency, index * 0.13, 0.18, { type: "triangle" }),
      );
      [523, 659, 784, 1047].forEach((frequency) =>
        T(frequency, 0.42, 0.9, { type: "triangle", vol: 0.55 }),
      );
      break;
  }
}

function toggle(): void {
  muted = !isMuted();
  try {
    localStorage.setItem(SOUND_STORAGE_KEY, muted ? "off" : "on");
  } catch {
    // saqlab bo'lmasa ham shu sahifada ishlaydi
  }
  listeners.forEach((listener) => listener());
  if (!muted) play("tap");
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/**
 * O'yin ovozlari: `play(name)`, `muted`, `toggle()`. Holat bitta (modal va o'yin ekrani orasida
 * umumiy), `localStorage` da eslab qolinadi. Brauzer ovozga faqat bosishdan keyin ruxsat beradi,
 * shuning uchun `AudioContext` birinchi bosishda ishga tushadi.
 */
export function useSound() {
  const value = useSyncExternalStore(subscribe, isMuted, () => false);

  useEffect(() => {
    const unlock = () => void context();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  return { muted: value, play, toggle };
}
