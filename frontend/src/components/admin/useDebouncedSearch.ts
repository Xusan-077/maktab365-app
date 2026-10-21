"use client";

import { useEffect, useRef, useState } from "react";

const DEBOUNCE_MS = 300;

/**
 * Qidiruv maydoni va URL (`?q=`) sinxroni: yozilgan matn `DEBOUNCE_MS` dan keyin `onCommit` ga
 * beriladi; URL tashqaridan o'zgarsa (orqaga, topbar qidiruvi) maydon ham yangilanadi.
 */
export function useDebouncedSearch(
  urlValue: string | undefined,
  onCommit: (value?: string) => void,
) {
  const [text, setText] = useState(urlValue ?? "");
  const [seen, setSeen] = useState(urlValue);
  // Render paytida "oldingi qiymat" bilan solishtirish — effect ichida setState qilishdan yaxshi.
  if (urlValue !== seen) {
    setSeen(urlValue);
    setText(urlValue ?? "");
  }

  const commit = useRef(onCommit);
  useEffect(() => {
    commit.current = onCommit;
  });

  useEffect(() => {
    const next = text.trim() || undefined;
    if (next === urlValue) return;
    const timer = setTimeout(() => commit.current(next), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text, urlValue]);

  return [text, setText] as const;
}
