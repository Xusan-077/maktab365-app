"use client";

import { useMemo } from "react";
import { contentsProgress, type BookContents } from "@/lib/pdf/book-contents";
import { useBookPosition } from "./useBookPosition";

/** Mundarija holatlari (paragraf, bob, umumiy foiz) — `useBookPosition` ustida, memo bilan. */
export function useBookContentsProgress(bookId: string, contents: BookContents) {
  const position = useBookPosition(bookId);
  const progress = useMemo(
    () => contentsProgress(contents, position.page),
    [contents, position.page],
  );
  return { ...position, progress };
}
