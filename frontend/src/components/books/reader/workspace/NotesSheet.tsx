"use client";

import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { EASE_OUT, m } from "@/components/ui/motion";
import { nextSheetState, SHEET_FRACTION, snapSheet, type SheetState } from "@/lib/books/workspace";

export interface NotesSheetProps {
  state: SheetState;
  onStateChange: (state: SheetState) => void;
  children: ReactNode;
}

/**
 * Mobil: kitob ostidagi pastki panel (3 holat: yopiq / yarim / to'liq). U oqimda turadi — ochilganda
 * bet siqiladi, chizish uchun yopilmaydi. Tutqichni sudrash yoki bosish holatni almashtiradi.
 */
export function NotesSheet({ state, onStateChange, children }: NotesSheetProps) {
  const t = useTranslations("books.workspace.notes");
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const start = useRef<{
    y: number;
    height: number;
    at: number;
    lastY: number;
    lastAt: number;
  } | null>(null);
  const container = useRef<HTMLDivElement>(null);

  const screen = () => (typeof window === "undefined" ? 800 : window.innerHeight);
  const target = SHEET_FRACTION[state] * screen();

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const height = container.current?.getBoundingClientRect().height ?? target;
    start.current = {
      y: event.clientY,
      height,
      at: event.timeStamp,
      lastY: event.clientY,
      lastAt: event.timeStamp,
    };
  };
  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const origin = start.current;
    if (!origin) return;
    const next = origin.height - (event.clientY - origin.y);
    setDragHeight(Math.min(Math.max(next, 0), SHEET_FRACTION.full * screen()));
    origin.lastY = event.clientY;
    origin.lastAt = event.timeStamp;
  };
  const onPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const origin = start.current;
    start.current = null;
    if (!origin) return;
    const moved = Math.abs(event.clientY - origin.y);
    if (moved < 6) {
      setDragHeight(null);
      onStateChange(nextSheetState(state));
      return;
    }
    const height = dragHeight ?? origin.height;
    const velocity = (event.clientY - origin.lastY) / Math.max(event.timeStamp - origin.lastAt, 1);
    setDragHeight(null);
    onStateChange(snapSheet(height / screen(), velocity));
  };

  const open = state !== "closed";

  return (
    <m.div
      ref={container}
      data-notes-sheet
      data-state={state}
      initial={false}
      animate={{ height: dragHeight ?? target }}
      transition={dragHeight === null ? { duration: 0.28, ease: EASE_OUT } : { duration: 0 }}
      className="bg-bk-bar border-bk-line relative z-30 flex shrink-0 flex-col overflow-hidden border-t lg:hidden"
      inert={!open}
    >
      <button
        type="button"
        aria-label={t("handle")}
        aria-expanded={open}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="flex h-6 w-full shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
      >
        <span className="bg-bk-line h-1 w-10 rounded-full" aria-hidden />
      </button>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </m.div>
  );
}
