"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";

/** Elementni to'liq ekranga chiqarish (Fullscreen API); qo'llab-quvvatlanmasa `supported = false`. */
export function useFullscreen(ref: RefObject<HTMLElement | null>) {
  const [active, setActive] = useState(false);
  // Reader brauzerda ishlaydi (SSR'siz), shuning uchun render paytida aniqlash xavfsiz.
  const supported =
    typeof document !== "undefined" &&
    typeof document.documentElement.requestFullscreen === "function";

  useEffect(() => {
    const onChange = () => setActive(document.fullscreenElement === ref.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [ref]);

  const toggle = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void element.requestFullscreen().catch(() => undefined);
  }, [ref]);

  return { active, supported, toggle };
}
