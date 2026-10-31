"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const HIDE_AFTER_MS = 3500;

/**
 * Tepa va pastki panellarning o'zi yashirinishi: sichqoncha/klaviatura harakatsiz qolsa
 * (`HIDE_AFTER_MS`) yashiriladi; harakat yoki fokus kirsa ko'rinadi. `pinned` (ochiq panel/menyu)
 * bo'lganda hech qachon yashirilmaydi. Sensorli ekranda bosish `toggle` qiladi.
 */
export function useIdleChrome(pinned: boolean) {
  const [visible, setVisible] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinnedRef = useRef(pinned);

  useEffect(() => {
    pinnedRef.current = pinned;
  }, [pinned]);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!pinnedRef.current) setVisible(false);
    }, HIDE_AFTER_MS);
  }, []);

  const reveal = useCallback(() => {
    setVisible(true);
    schedule();
  }, [schedule]);

  const toggle = useCallback(() => {
    setVisible((value) => !value);
    schedule();
  }, [schedule]);

  useEffect(() => {
    schedule();
    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "mouse") reveal();
    };
    const onKey = () => reveal();
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("keydown", onKey);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [reveal, schedule]);

  return { visible: visible || pinned, reveal, toggle };
}
