"use client";

import { useEffect, useRef, useState } from "react";

const TICK_MS = 200;

/**
 * Teskari sanoq (soniya, kasr bilan): `running` bo'lganda kamayadi, to'xtatilsa qolgan vaqt saqlanadi.
 * Vaqt `Date.now()` bo'yicha — tab sekinlashsa ham to'g'ri. 0 ga yetganda `onExpire` bir marta.
 */
export function useCountdown(totalSeconds: number, running: boolean, onExpire: () => void) {
  const [remaining, setRemaining] = useState(totalSeconds);
  const expire = useRef(onExpire);
  useEffect(() => {
    expire.current = onExpire;
  });

  useEffect(() => {
    if (!running || remaining <= 0) return;
    const deadline = Date.now() + remaining * 1000;
    const timer = setInterval(() => {
      const left = Math.max(0, (deadline - Date.now()) / 1000);
      setRemaining(left);
      if (left === 0) {
        clearInterval(timer);
        expire.current();
      }
    }, TICK_MS);
    return () => clearInterval(timer);
    // `remaining` faqat qayta ishga tushganda o'qiladi (har tikda interval qayta yaratilmasin).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  return remaining;
}
