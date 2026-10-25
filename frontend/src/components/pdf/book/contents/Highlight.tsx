import { highlightParts } from "@/lib/pdf/book-contents";

/** Qidiruvga mos bo'laklar `<mark>` bilan (matn React orqali — HTML kiritilmaydi). */
export function Highlight({ text, query }: { text: string; query: string }) {
  return highlightParts(text, query).map((part, index) =>
    part.match ? (
      <mark key={index} className="bg-accent-soft text-accent-soft-foreground rounded-sm">
        {part.text}
      </mark>
    ) : (
      part.text
    ),
  );
}
