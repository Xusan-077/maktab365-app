"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Highlighter, Lightbulb, NotebookPen } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AnnotationRect } from "@/lib/pdf/annotations";
import { menuPosition, selectionRects } from "@/lib/pdf/selection";

/** Belgilangan matn: matn, bet va bet qutisiga nisbatan rect'lar. */
export interface TextSelection {
  text: string;
  page: number;
  rects: AnnotationRect[];
}

export interface SelectionMenuProps {
  /** Bet maydoni: faqat shu ichidagi matn qatlamidagi belgilash hisobga olinadi. */
  areaRef: RefObject<HTMLElement | null>;
  onSolution: (selection: TextSelection) => void;
  onNote: (selection: TextSelection) => void;
  onHighlight: (selection: TextSelection) => void;
}

/** Menyu o'lchami (joylashuvni hisoblash uchun) va sarlavha balandligi. */
const MENU = { width: 330, height: 48, gap: 8, minTop: 72 };
const MAX_TEXT = 500;

/** Joriy belgilash bet maydonidagi matn qatlamida bo'lsa — uning ma'lumotlari va joyi. */
function readSelection(area: HTMLElement | null) {
  const selection = window.getSelection?.();
  if (!area || !selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  const text = selection.toString().replace(/\s+/g, " ").trim().slice(0, MAX_TEXT);
  if (!text) return null;
  const range = selection.getRangeAt(0);
  const start =
    range.startContainer instanceof Element
      ? range.startContainer
      : range.startContainer.parentElement;
  const layer = start?.closest(".textLayer");
  if (!layer || !area.contains(layer)) return null;
  const box = layer.parentElement;
  const page = Number(box?.querySelector<HTMLElement>("[data-page]")?.dataset.page);
  if (!box || !Number.isInteger(page) || page < 1) return null;
  const rects = selectionRects(Array.from(range.getClientRects()), box.getBoundingClientRect());
  return { value: { text, page, rects }, bounds: range.getBoundingClientRect() };
}

/**
 * Matn qatlamida belgilangan matn ustida kichik menyu: «Yechimini ko'rish», «Konspektga qo'shish»,
 * «Belgilash». Sichqoncha/barmoq qo'yilganda yoki klaviatura bilan belgilangach chiqadi; Esc,
 * belgilash bekor bo'lishi yoki scroll yopadi.
 */
export function SelectionMenu({ areaRef, onSolution, onNote, onHighlight }: SelectionMenuProps) {
  const t = useTranslations("pdfBooks.selection");
  const [state, setState] = useState<{
    value: TextSelection;
    top: number;
    left: number;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const show = () => {
      const found = readSelection(areaRef.current);
      if (!found) return setState(null);
      const position = menuPosition(
        found.bounds,
        { width: window.innerWidth, height: window.innerHeight },
        { ...MENU, width: Math.min(MENU.width, window.innerWidth - 16) },
      );
      setState({ value: found.value, ...position });
    };
    const onPointerUp = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      // Brauzer belgilashni pointerup'dan keyin yakunlaydi.
      window.setTimeout(show, 0);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.shiftKey || event.key === "Shift") show();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setState(null);
    };
    const onSelectionChange = () => {
      if (window.getSelection?.()?.isCollapsed !== false) setState(null);
    };
    const hide = () => setState(null);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("keyup", onKeyUp);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("selectionchange", onSelectionChange);
    window.addEventListener("scroll", hide, { passive: true });
    return () => {
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("selectionchange", onSelectionChange);
      window.removeEventListener("scroll", hide);
    };
  }, [areaRef]);

  if (!state) return null;

  const run = (action: (selection: TextSelection) => void) => {
    action(state.value);
    setState(null);
    window.getSelection?.()?.removeAllRanges();
  };
  const items = [
    { id: "solution", icon: Lightbulb, onClick: () => run(onSolution) },
    { id: "note", icon: NotebookPen, onClick: () => run(onNote) },
    { id: "highlight", icon: Highlighter, onClick: () => run(onHighlight) },
  ] as const;

  return (
    <div
      ref={menuRef}
      role="toolbar"
      aria-label={t("label")}
      data-testid="selection-menu"
      className="border-ds-line bg-ds-ink text-ds-surface font-ui rounded-ds-sm fixed z-50 flex max-w-[calc(100vw-1rem)] items-center gap-0.5 border p-1 shadow-lg"
      style={{ top: state.top, left: state.left }}
      // Tugma bosilganda belgilash yo'qolmasin.
      onPointerDown={(event) => event.preventDefault()}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          data-testid={`selection-${item.id}`}
          onClick={item.onClick}
          className="hover:bg-ds-surface/15 flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-[0.8125rem] font-semibold whitespace-nowrap"
        >
          <item.icon className="size-4 shrink-0" aria-hidden />
          {t(item.id)}
        </button>
      ))}
    </div>
  );
}
