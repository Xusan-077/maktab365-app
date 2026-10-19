import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface AccordionItem {
  id: string;
  title: ReactNode;
  content: ReactNode;
  /** Dastlab ochiq turadi. */
  defaultOpen?: boolean;
}

export interface AccordionProps {
  items: AccordionItem[];
  /** Berilsa, bir vaqtda faqat bitta element ochiq turadi. */
  exclusiveName?: string;
  className?: string;
}

/** Native `<details>` asosida: Enter/Space bilan ochiladi, ekran o'qigichlar bilan mos. */
export function Accordion({ items, exclusiveName, className }: AccordionProps) {
  return (
    <div
      className={cn("divide-border border-border bg-surface divide-y rounded-xl border", className)}
    >
      {items.map((item) => (
        <details key={item.id} name={exclusiveName} open={item.defaultOpen} className="group">
          <summary className="text-foreground hover:bg-subtle flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
            {item.title}
            <ChevronDown
              className="text-muted size-4 shrink-0 transition-transform group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <div className="text-muted px-4 pb-4 text-sm">{item.content}</div>
        </details>
      ))}
    </div>
  );
}
