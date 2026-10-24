"use client";

import { useTranslations } from "next-intl";
import { ContinueReadingCard } from "@/components/site/ContinueReadingCard";
import { useContinueBooks } from "@/hooks/useContinueBooks";

/** "O'qishni davom ettiring": oxirgi 2 ta boshlangan kitob. Hech narsa yo'q bo'lsa bo'lim chizilmaydi. */
export function ContinueSection() {
  const t = useTranslations("home.continue");
  const { ready, items } = useContinueBooks(2);

  if (!ready || items.length === 0) return null;

  return (
    <section aria-labelledby="home-continue" className="flex flex-col gap-5">
      <h2 id="home-continue" className="text-[1.75rem] font-extrabold tracking-[-0.02em]">
        {t("title")}
      </h2>
      <ul data-testid="home-resume" className="grid gap-4 md:grid-cols-2">
        {items.map(({ book, page }) => (
          <li key={book.id}>
            <ContinueReadingCard book={book} lastPage={page} />
          </li>
        ))}
      </ul>
    </section>
  );
}
