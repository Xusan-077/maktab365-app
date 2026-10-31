// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

const param = () => ({
  value: 0,
  setValueAtTime: vi.fn(),
  exponentialRampToValueAtTime: vi.fn(),
});

interface FakeOscillator {
  type: string;
  frequency: ReturnType<typeof param>;
  connect: (target: unknown) => unknown;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  state = "running";
  currentTime = 10;
  sampleRate = 100;
  destination = {};
  oscillators: FakeOscillator[] = [];
  gains: { gain: ReturnType<typeof param> }[] = [];
  sources = 0;
  resume = vi.fn();

  constructor() {
    FakeAudioContext.instances.push(this);
  }
  createOscillator() {
    const oscillator: FakeOscillator = {
      type: "sine",
      frequency: param(),
      connect: (target) => target,
      start: vi.fn(),
      stop: vi.fn(),
    };
    this.oscillators.push(oscillator);
    return oscillator;
  }
  createGain() {
    const gain = { gain: param(), connect: (target: unknown) => target };
    this.gains.push(gain);
    return gain;
  }
  createBuffer(_channels: number, length: number) {
    return { getChannelData: () => new Float32Array(length) };
  }
  createBufferSource() {
    this.sources += 1;
    return { buffer: null, connect: (target: unknown) => target, start: vi.fn() };
  }
  createBiquadFilter() {
    return { type: "", frequency: { value: 0 }, connect: (target: unknown) => target };
  }
}

/** Modul holati (`muted`, `AudioContext`) har test uchun yangidan. */
async function setup() {
  vi.resetModules();
  const { useSound, SOUND_STORAGE_KEY } = await import("./useSound");
  return { ...renderHook(() => useSound()), SOUND_STORAGE_KEY };
}

const lastContext = () => FakeAudioContext.instances.at(-1)!;

beforeEach(() => {
  FakeAudioContext.instances = [];
  localStorage.clear();
  vi.stubGlobal("AudioContext", FakeAudioContext);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useSound", () => {
  it("is on by default and synthesizes tones like D365.sound", async () => {
    const { result } = await setup();
    expect(result.current.muted).toBe(false);

    act(() => result.current.play("correct"));
    const { oscillators, gains } = lastContext();
    expect(oscillators.map((o) => o.type)).toEqual(["triangle", "triangle"]);
    expect(oscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(659, 10);
    expect(oscillators[1].frequency.setValueAtTime).toHaveBeenCalledWith(988, 10.1);
    expect(oscillators[1].stop).toHaveBeenCalledWith(10 + 0.1 + 0.22 + 0.02);
    // Balandlik 0.35.
    expect(gains[0].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.35, 10.012);
  });

  it.each([
    ["tap", 1, 0],
    ["open", 1, 0],
    ["wrong", 2, 0],
    ["tick", 1, 0],
    ["land", 2, 0],
    ["bonus", 4, 0],
    ["bomb", 1, 1],
    ["pull", 2, 1],
    ["beep", 1, 0],
    ["win", 7, 0],
  ] as const)("%s plays %i tones and %i noise", async (name, tones, noises) => {
    const { result } = await setup();
    act(() => result.current.play(name));
    expect(lastContext().oscillators).toHaveLength(tones);
    expect(lastContext().sources).toBe(noises);
  });

  it("does not play or create a context when muted", async () => {
    localStorage.setItem("d365-sound", "off");
    const { result } = await setup();
    expect(result.current.muted).toBe(true);
    act(() => result.current.play("win"));
    expect(FakeAudioContext.instances).toHaveLength(0);
  });

  it("persists the state in localStorage on toggle", async () => {
    const { result, SOUND_STORAGE_KEY } = await setup();
    act(() => result.current.toggle());
    expect(result.current.muted).toBe(true);
    expect(localStorage.getItem(SOUND_STORAGE_KEY)).toBe("off");
    act(() => result.current.play("tap"));
    expect(FakeAudioContext.instances).toHaveLength(0);

    act(() => result.current.toggle());
    expect(result.current.muted).toBe(false);
    expect(localStorage.getItem(SOUND_STORAGE_KEY)).toBe("on");
    // Yoqilganda tasdiq ovozi.
    expect(lastContext().oscillators).toHaveLength(1);
  });

  it("works when localStorage throws", async () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { result } = await setup();
    expect(result.current.muted).toBe(false);
    act(() => result.current.toggle());
    expect(result.current.muted).toBe(true);
    spy.mockRestore();
    set.mockRestore();
  });

  it("starts the AudioContext on the first pointer press only", async () => {
    await setup();
    expect(FakeAudioContext.instances).toHaveLength(0);
    window.dispatchEvent(new Event("pointerdown"));
    window.dispatchEvent(new Event("pointerdown"));
    expect(FakeAudioContext.instances).toHaveLength(1);
  });
});
