"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  clampPanelWidth,
  MAX_PANEL_WIDTH,
  MIN_PANEL_WIDTH,
  PANEL_KEY_STEP,
} from "@/lib/books/workspace";
import { cn } from "@/lib/utils/cn";

export interface NotesAsideProps {
  width: number;
  onWidthChange: (width: number, available: number) => void;
  children: ReactNode;
}

/**
 * Desktop: kitobning o'ng tomonidagi yon panel. Chap chetdagi ajratgich sichqoncha/sensor bilan
 * sudraladi yoki klaviatura (←/→, Home/End) bilan o'zgartiriladi; kenglik qo'yib yuborilganda saqlanadi.
 */
export function NotesAside({ width, onWidthChange, children }: NotesAsideProps) {
  const t = useTranslations("books.workspace.notes");
  const aside = useRef<HTMLElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const shown = drag ?? width;

  const available = () => aside.current?.parentElement?.getBoundingClientRect().width ?? 1200;

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag(width);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (drag === null || !aside.current) return;
    const right = aside.current.getBoundingClientRect().right;
    setDrag(clampPanelWidth(right - event.clientX, available()));
  };
  const onPointerUp = () => {
    if (drag !== null) onWidthChange(drag, available());
    setDrag(null);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? PANEL_KEY_STEP * 3 : PANEL_KEY_STEP;
    let next = width;
    if (event.key === "ArrowLeft") next = width + step;
    else if (event.key === "ArrowRight") next = width - step;
    else if (event.key === "Home") next = MIN_PANEL_WIDTH;
    else if (event.key === "End") next = MAX_PANEL_WIDTH;
    else return;
    event.preventDefault();
    onWidthChange(next, available());
  };

  return (
    <aside
      ref={aside}
      data-notes-aside
      aria-label={t("title")}
      className="border-bk-line relative hidden shrink-0 border-l lg:flex"
      style={{ width: shown }}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={t("resize")}
        aria-valuemin={MIN_PANEL_WIDTH}
        aria-valuemax={MAX_PANEL_WIDTH}
        aria-valuenow={shown}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className={cn(
          "group absolute inset-y-0 -left-1.5 z-10 flex w-3 cursor-col-resize touch-none justify-center",
          "focus-visible:outline-none",
        )}
      >
        <span
          className={cn(
            "bg-bk-accent/0 group-hover:bg-bk-accent/40 group-focus-visible:bg-bk-accent h-full w-0.5 transition-colors",
            drag !== null && "bg-bk-accent",
          )}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </aside>
  );
}
