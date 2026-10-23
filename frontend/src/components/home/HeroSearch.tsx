"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Search } from "lucide-react";
import { buttonVariants } from "@/components/ui/Button";

export interface HeroSearchProps {
  action: string;
  label: string;
  /** Tilga mos misollar: placeholder'da birin-ketin "yozib" ko'rsatiladi. */
  examples: string[];
  submitLabel: string;
}

const TYPE_MS = 70;
const ERASE_MS = 35;
const HOLD_MS = 1600;

/** Qidiruv: bo'sh va fokussiz paytda placeholder misollarni yozib-o'chirib turadi (JS yo'q bo'lsa birinchi misol). */
export function HeroSearch({ action, label, examples, submitLabel }: HeroSearchProps) {
  const [placeholder, setPlaceholder] = useState(examples[0] ?? "");
  const [idle, setIdle] = useState(true);

  useEffect(() => {
    if (!idle || examples.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let index = 0;
    let length = examples[0].length;

    const step = (erasing: boolean) => {
      if (cancelled) return;
      const word = examples[index];
      if (erasing) {
        length -= 1;
        setPlaceholder(word.slice(0, length));
        if (length <= 0) {
          index = (index + 1) % examples.length;
          timer = setTimeout(() => step(false), 250);
        } else {
          timer = setTimeout(() => step(true), ERASE_MS);
        }
      } else {
        length += 1;
        setPlaceholder(word.slice(0, length));
        const done = length >= word.length;
        timer = setTimeout(() => step(done), done ? HOLD_MS : TYPE_MS);
      }
    };
    timer = setTimeout(() => step(true), HOLD_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [idle, examples]);

  return (
    <form
      role="search"
      action={action}
      method="get"
      style={{ "--i": 2 } as CSSProperties}
      className="enter flex w-full max-w-xl gap-2"
    >
      <div className="relative min-w-0 flex-1">
        <Search
          className="text-muted pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2"
          aria-hidden
        />
        <input
          type="search"
          name="q"
          aria-label={label}
          placeholder={placeholder}
          onFocus={() => setIdle(false)}
          onBlur={(event) => setIdle(event.currentTarget.value === "")}
          className="border-border bg-surface text-foreground placeholder:text-muted hover:border-primary-300 focus:border-primary-400 h-12 w-full rounded-xl border pr-3 pl-12 text-base shadow-sm transition-[border-color,box-shadow] focus:shadow-md"
        />
      </div>
      <button type="submit" className={buttonVariants({ size: "lg", className: "px-5" })}>
        {submitLabel}
      </button>
    </form>
  );
}
