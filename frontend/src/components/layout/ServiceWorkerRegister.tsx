"use client";

import { useEffect } from "react";

/**
 * Service Worker'ni ro'yxatdan o'tkazadi (faqat production, brauzer qo'llasa). Dev'da keshlash
 * HMR bilan to'qnashadi, shuning uchun u yerda yoqilmaydi.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const register = () =>
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    // Sahifa yuklanishini sekinlashtirmaslik uchun load'dan keyin.
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);
  return null;
}
