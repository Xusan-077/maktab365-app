"use client";

import { useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import type { Resolved } from "@/lib/i18n/localize-blocks";
import { cn } from "@/lib/utils/cn";
import type { TimelineProps } from "@/types/topic";
import { WidgetFrame } from "./WidgetFrame";

const NAV_KEYS: Record<string, (index: number, last: number) => number> = {
  ArrowDown: (i, last) => Math.min(i + 1, last),
  ArrowRight: (i, last) => Math.min(i + 1, last),
  ArrowUp: (i) => Math.max(i - 1, 0),
  ArrowLeft: (i) => Math.max(i - 1, 0),
  Home: () => 0,
  End: (_, last) => last,
};

/**
 * Vaqt chizig'i: mobilda vertikal (izoh sana ostida), `md` dan boshlab gorizontal (izoh qator ostida).
 * Sanalar — tugmalar: Tab/Enter/Space; ↑ ↓ ← →, Home, End — sanalar orasida yurish.
 */
export function Timeline({ events }: Resolved<TimelineProps>) {
  const t = useTranslations("topic.timeline");
  const uid = useId();
  const [openId, setOpenId] = useState<string | null>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (index: number, event: KeyboardEvent) => {
    const move = NAV_KEYS[event.key];
    if (!move) return;
    event.preventDefault();
    buttons.current[move(index, events.length - 1)]?.focus();
  };

  return (
    <WidgetFrame title={t("title")} hint={t("hint")}>
      <ol
        style={{ "--cols": events.length } as CSSProperties}
        className="relative flex flex-col gap-1 md:grid md:[grid-template-columns:repeat(var(--cols),minmax(0,1fr))] md:gap-x-2 md:gap-y-4"
      >
        <span
          aria-hidden
          className="bg-border absolute top-2 bottom-2 left-[1.1rem] w-0.5 md:top-[1.1rem] md:right-4 md:bottom-auto md:left-4 md:h-0.5 md:w-auto"
        />
        {events.map((event, index) => {
          const open = openId === event.id;
          const panelId = `${uid}-${event.id}`;
          return (
            <li key={event.id} className="relative flex flex-col gap-2 md:contents">
              <button
                ref={(node) => {
                  buttons.current[index] = node;
                }}
                type="button"
                aria-expanded={open}
                aria-controls={open ? panelId : undefined}
                onClick={() => setOpenId(open ? null : event.id)}
                onKeyDown={(keyEvent) => onKeyDown(index, keyEvent)}
                className="hover:bg-subtle relative flex min-h-12 items-center gap-3 rounded-lg py-1 pr-2 text-left md:flex-col md:items-start md:gap-2 md:pr-1"
              >
                <span
                  aria-hidden
                  className={cn(
                    "border-primary-600 relative z-10 ml-2.5 size-4 shrink-0 rounded-full border-2 md:ml-2",
                    open ? "bg-primary-600" : "bg-background",
                  )}
                />
                <span className="flex min-w-0 flex-col">
                  <span className="text-link font-semibold">{event.date}</span>
                  <span className="text-sm">{event.title}</span>
                </span>
              </button>
              {open && (
                <p
                  id={panelId}
                  className="bg-primary-soft text-primary-soft-foreground ml-9 rounded-lg px-4 py-3 text-base md:col-span-full md:row-start-2 md:ml-0"
                >
                  {event.description}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </WidgetFrame>
  );
}
