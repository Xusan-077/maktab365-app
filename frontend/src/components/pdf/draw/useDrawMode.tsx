"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useDrawings } from "@/hooks/useDrawings";
import { useToast } from "@/hooks/useToast";
import {
  MARKER_COLORS,
  MARKER_WIDTHS,
  PEN_COLORS,
  PEN_WIDTHS,
  type Annotation,
} from "@/lib/books/annotations";
import type { BookTheme } from "@/lib/books/reader";
import type { ReaderTone } from "@/lib/pdf/reader-prefs";
import {
  selectCanRedo,
  selectCanUndo,
  selectHasDrawings,
  selectPageItems,
  useBookAnnotationsStore,
} from "@/stores/book-annotations.store";
import { DrawLayer, type DrawTool } from "./DrawLayer";

type ActiveTool = Exclude<DrawTool, "none">;

/** Chizish sozlamalari shu qurilmada eslab qolinadi (asbob, ranglar, qalinlik). */
export const DRAW_PREFS_KEY = "maktab365-draw";

interface DrawPrefs {
  tool: ActiveTool;
  penColor: string;
  markerColor: string;
  penWidth: number;
  markerWidth: number;
}

const DEFAULT_PREFS: DrawPrefs = {
  tool: "pen",
  penColor: PEN_COLORS[0],
  markerColor: MARKER_COLORS[0],
  penWidth: 1,
  markerWidth: 1,
};

const index3 = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 2
    ? value
    : fallback;

export function readDrawPrefs(raw: string | null): DrawPrefs {
  try {
    const value = raw ? (JSON.parse(raw) as Partial<DrawPrefs>) : {};
    return {
      tool: value.tool === "marker" || value.tool === "eraser" ? value.tool : "pen",
      penColor: (PEN_COLORS as readonly string[]).includes(value.penColor ?? "")
        ? (value.penColor as string)
        : DEFAULT_PREFS.penColor,
      markerColor: (MARKER_COLORS as readonly string[]).includes(value.markerColor ?? "")
        ? (value.markerColor as string)
        : DEFAULT_PREFS.markerColor,
      penWidth: index3(value.penWidth, DEFAULT_PREFS.penWidth),
      markerWidth: index3(value.markerWidth, DEFAULT_PREFS.markerWidth),
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function loadPrefs(): DrawPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    return readDrawPrefs(window.localStorage.getItem(DRAW_PREFS_KEY));
  } catch {
    return DEFAULT_PREFS;
  }
}

const THEME_BY_TONE: Record<ReaderTone, BookTheme> = {
  light: "paper",
  sepia: "sepia",
  dark: "night",
};

/**
 * O'qish oynasidagi chizish rejimi: yoqish/o'chirish, asbob va sozlamalar, joriy bet undo/redo,
 * betni tozalash («Qaytarish» bilan) va kitobdagi barcha chizmalarni o'chirish. Chizmalar faqat
 * shu qurilmada saqlanadi — `useDrawings`.
 */
export function useDrawMode({
  bookId,
  page,
  tone,
}: {
  bookId: string;
  page: number | null;
  tone: ReaderTone;
}) {
  const t = useTranslations("pdfBooks.draw");
  const { toast } = useToast();
  const drawings = useDrawings(bookId);
  const [on, setOn] = useState(false);
  // `PdfReader` faqat brauzerda (SSR'siz) render bo'ladi: localStorage darhol o'qiladi.
  const [prefs, setPrefs] = useState<DrawPrefs>(loadPrefs);

  const update = useCallback((patch: Partial<DrawPrefs>) => {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      try {
        window.localStorage.setItem(DRAW_PREFS_KEY, JSON.stringify(next));
      } catch {
        // Bloklangan storage — sozlama faqat shu sessiyada.
      }
      return next;
    });
  }, []);

  // Chizmalar qurilmadan o'qilmaguncha chizish yopiq (saqlangan nusxa ustidan yozilmasin).
  const tool: DrawTool = on && drawings.ready ? prefs.tool : "none";
  const marker = prefs.tool === "marker";
  const colors = marker ? MARKER_COLORS : PEN_COLORS;
  const color = marker ? prefs.markerColor : prefs.penColor;
  const widthIndex = marker ? prefs.markerWidth : prefs.penWidth;
  const width = marker ? MARKER_WIDTHS[widthIndex] : PEN_WIDTHS[widthIndex];
  const theme = THEME_BY_TONE[tone];

  const canUndo = useBookAnnotationsStore(selectCanUndo(page ?? 0));
  const pageItems = useBookAnnotationsStore(selectPageItems(page ?? 0));
  const hasDrawings = useBookAnnotationsStore(selectHasDrawings);
  const canRedo = useBookAnnotationsStore(selectCanRedo(page ?? 0));
  const undo = useCallback(() => {
    if (page !== null) useBookAnnotationsStore.getState().undo(page);
  }, [page]);
  const redo = useCallback(() => {
    if (page !== null) useBookAnnotationsStore.getState().redo(page);
  }, [page]);

  // Ctrl/⌘+Z, Ctrl/⌘+Shift+Z (yoki Ctrl+Y), Esc — faqat chizish rejimida.
  useEffect(() => {
    if (!on) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest("input, textarea, [contenteditable]")) return;
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (mod && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
      } else if (event.key === "Escape") {
        setOn(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [on, undo, redo]);

  const commit = useCallback((pageNumber: number, items: readonly Annotation[]) => {
    useBookAnnotationsStore.getState().commit(pageNumber, items);
  }, []);
  const onLimit = useCallback(() => toast({ variant: "error", title: t("limit") }), [toast, t]);

  /** Joriy betdagi barcha chizmalar o'chadi (undo tarixida ham qoladi) va «Qaytarish» taklif qilinadi. */
  const clearPage = useCallback(() => {
    if (page === null) return;
    const store = useBookAnnotationsStore.getState();
    const previous = selectPageItems(page)(store);
    if (previous.length === 0) return;
    store.commit(page, []);
    toast({
      title: t("pageCleared"),
      action: {
        label: t("restore"),
        onClick: () => {
          const now = useBookAnnotationsStore.getState();
          // Tozalangandan keyin yangi chizilgan bo'lsa — eskilari ustiga qo'shiladi.
          const current = selectPageItems(page)(now);
          const ids = new Set(current.map((item) => item.id));
          now.commit(page, [...previous.filter((item) => !ids.has(item.id)), ...current]);
        },
      },
    });
  }, [page, toast, t]);

  return {
    on,
    tool,
    theme,
    color,
    width,
    widthIndex,
    colors,
    activeTool: prefs.tool,
    canUndo,
    canRedo,
    /** Joriy betda chizma bor (tozalash tugmasi). */
    pageHasDrawings: pageItems.length > 0,
    /** Kitobda chizma bor («Hammasini o'chirish»). */
    hasDrawings,
    toggle: () => setOn((value) => !value),
    close: () => setOn(false),
    setTool: (next: ActiveTool) => update({ tool: next }),
    setColor: (next: string) => update(marker ? { markerColor: next } : { penColor: next }),
    setWidth: (next: number) => update(marker ? { markerWidth: next } : { penWidth: next }),
    undo,
    redo,
    clearPage,
    clearBook: drawings.clearAll,
    commit,
    onLimit,
  };
}

export type DrawMode = ReturnType<typeof useDrawMode>;

/** Bitta bet ustidagi qatlam: shu betning chizmalari store'dan (faqat ko'rinib turgan ±1 betda). */
export function PageDrawing({
  draw,
  pageNumber,
  pixelScale,
  onPan,
}: {
  draw: DrawMode;
  pageNumber: number;
  pixelScale?: number;
  onPan?: (dx: number, dy: number) => void;
}) {
  const items = useBookAnnotationsStore(selectPageItems(pageNumber));
  const { commit } = draw;
  const onCommit = useCallback(
    (next: readonly Annotation[]) => commit(pageNumber, next),
    [commit, pageNumber],
  );
  // Chizma yo'q va rejim o'chiq — canvas umuman yaratilmaydi.
  if (items.length === 0 && draw.tool === "none") return null;
  return (
    <DrawLayer
      items={items}
      tool={draw.tool}
      color={draw.color}
      width={draw.width}
      theme={draw.theme}
      pixelScale={pixelScale}
      onCommit={onCommit}
      onLimit={draw.onLimit}
      onPan={onPan}
    />
  );
}
