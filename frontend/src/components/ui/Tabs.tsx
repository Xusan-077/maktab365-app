"use client";

import { useId, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface TabItem {
  id: string;
  label: ReactNode;
  content: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  /** Tablist uchun nom (ekran o'qigichlar). */
  label: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (id: string) => void;
  /** `true` — faol bo'lmagan panellar ham DOM'da (`hidden`): ichidagi holat (yuklash, forma) yo'qolmaydi. */
  keepMounted?: boolean;
  className?: string;
}

export function Tabs({
  items,
  label,
  defaultValue,
  value,
  onValueChange,
  keepMounted,
  className,
}: TabsProps) {
  const baseId = useId();
  const [inner, setInner] = useState(defaultValue ?? items.find((i) => !i.disabled)?.id);
  const current = value ?? inner;

  function select(id: string) {
    if (value === undefined) setInner(id);
    onValueChange?.(id);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const tabs = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'),
    );
    const index = tabs.findIndex((tab) => tab === document.activeElement);
    if (index < 0) return;
    const next =
      e.key === "ArrowRight"
        ? (index + 1) % tabs.length
        : e.key === "ArrowLeft"
          ? (index - 1 + tabs.length) % tabs.length
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? tabs.length - 1
              : -1;
    if (next < 0) return;
    e.preventDefault();
    tabs[next].focus();
    tabs[next].click();
  }

  const active = items.find((i) => i.id === current);

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="border-border flex gap-1 overflow-x-auto overflow-y-hidden border-b"
      >
        {items.map((item) => {
          const selected = item.id === current;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              disabled={item.disabled}
              onClick={() => select(item.id)}
              className={cn(
                "-mb-px shrink-0 rounded-t-md border-b-2 px-4 py-2.5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
                selected
                  ? "border-primary-600 text-link"
                  : "text-muted hover:text-foreground border-transparent",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {(keepMounted ? items : active ? [active] : []).map((item) => (
        <div
          key={item.id}
          role="tabpanel"
          id={`${baseId}-panel-${item.id}`}
          aria-labelledby={`${baseId}-tab-${item.id}`}
          hidden={item.id !== active?.id}
          tabIndex={0}
          className="rounded-md pt-4"
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}
