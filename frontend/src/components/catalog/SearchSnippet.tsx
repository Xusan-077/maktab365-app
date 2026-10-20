import { splitSnippet } from "@/lib/utils/search-snippet";

/** Qidiruv snippeti: mos so'zlar `<mark>` bilan ajratiladi (matn oddiy matn sifatida chiziladi). */
export function SearchSnippet({ snippet, className }: { snippet?: string; className?: string }) {
  if (!snippet) return null;
  return (
    <p className={className}>
      {splitSnippet(snippet).map((part, index) =>
        part.match ? (
          <mark
            key={index}
            className="bg-accent-soft text-accent-soft-foreground rounded-sm px-0.5"
          >
            {part.text}
          </mark>
        ) : (
          part.text
        ),
      )}
    </p>
  );
}
