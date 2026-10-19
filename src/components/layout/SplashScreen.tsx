"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  isSplashDismissKey,
  SPLASH_DURATION_MS,
  SPLASH_SKIP_FADE_MS,
  SPLASH_STORAGE_KEY,
} from "@/lib/utils/splash";
import { SplashMark } from "./SplashMark";

type Phase = "idle" | "playing" | "closing" | "done";

/**
 * Bosh sahifaga birinchi kirishdagi splash. Server HTML'iga hech narsa chiqarmaydi (faqat client'da mount):
 * botlar va JS o'chiq holatda sahifa odatdagidek. Birinchi paintda flash bo'lmasligi uchun `<head>`
 * skripti `data-splash="show"` qo'yadi va `globals.css` shu paytgacha fonni qoplab turadi; overlay DOM'ga
 * chiqqach `data-splash="active"`, yopilgach `done` bo'ladi. Faqat transform/opacity animatsiyalanadi.
 */
export function SplashScreen() {
  const t = useTranslations("brand");
  const [phase, setPhase] = useState<Phase>("idle");

  useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.splash !== "show") return;
    try {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        throw new Error("reduced-motion");
      }
      sessionStorage.setItem(SPLASH_STORAGE_KEY, "1");
    } catch {
      // Storage yozilmasa yoki harakat cheklangan bo'lsa splash umuman chiqmaydi
      root.dataset.splash = "skip";
      return;
    }
    // Brauzer holati (data-splash, sessionStorage) faqat mount'dan keyin o'qiladi: SSR'da overlay yo'q
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhase("playing");
  }, []);

  // Overlay DOM'ga chiqqandan keyin (paintdan oldin) qoplama fonni olib tashlaymiz: oraliqda flash yo'q
  useLayoutEffect(() => {
    if (phase === "playing") document.documentElement.dataset.splash = "active";
    if (phase === "done") document.documentElement.dataset.splash = "done";
  }, [phase]);

  const visible = phase === "playing" || phase === "closing";

  // Scroll qulfi va fokusni avvalgi holatga qaytarish
  useEffect(() => {
    if (!visible) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus && previousFocus !== document.body) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [visible]);

  useEffect(() => {
    if (phase !== "playing") return;
    const finish = setTimeout(() => setPhase("done"), SPLASH_DURATION_MS);
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isSplashDismissKey(event.key)) return;
      event.preventDefault();
      setPhase("closing");
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      clearTimeout(finish);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "closing") return;
    const timer = setTimeout(() => setPhase("done"), SPLASH_SKIP_FADE_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      data-phase={phase}
      className="m365-splash"
      onPointerDown={() => setPhase("closing")}
    >
      <SplashMark className="m365-splash-logo" />
      <p className="m365-splash-text">{t("tagline")}</p>
      <span className="m365-splash-bar" />
    </div>
  );
}
