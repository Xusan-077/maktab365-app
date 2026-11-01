"use client";

import { useEffect, type RefObject } from "react";
import { isBlockedShortcut, isEditableTarget } from "@/lib/reader/protection";

/**
 * O'qish oynasida: kontekst menyu, nusxa olish/kesish, sudrash va Ctrl+S / Ctrl+P bloklanadi.
 * Qidiruv (PDF.js matn qatlami) belgilashga tayanmaydi, shuning uchun ishlayveradi.
 * Faqat shu oyna ochiq bo'lganda ta'sir qiladi (unmount'da hammasi olib tashlanadi).
 */
export function useReaderProtection(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = root.current;
    const block = (event: Event) => {
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
    };
    const onKey = (event: KeyboardEvent) => {
      if (isBlockedShortcut(event)) event.preventDefault();
    };
    const scoped = ["contextmenu", "copy", "cut", "dragstart", "selectstart"] as const;
    if (element) for (const name of scoped) element.addEventListener(name, block);
    window.addEventListener("keydown", onKey);
    return () => {
      if (element) for (const name of scoped) element.removeEventListener(name, block);
      window.removeEventListener("keydown", onKey);
    };
  }, [root]);
}
