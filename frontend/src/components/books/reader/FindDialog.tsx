"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SearchX } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { BOOK_SEARCH_MIN_LENGTH, bookQueries } from "@/lib/books/queries";
import { splitMatches } from "@/lib/books/reader";

const SEARCH_DELAY_MS = 350;

export interface FindDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookId: string;
  /** Kitobda matn qatlami bor (skanerlangan kitobda qidiruv ishlamaydi). */
  searchable: boolean;
  onGo: (page: number) => void;
}

/** Kitob ichida qidirish: moslik topilgan betlar va matn parchalari; tanlansa o'sha betga o'tadi. */
export function FindDialog({ open, onOpenChange, bookId, searchable, onGo }: FindDialogProps) {
  const t = useTranslations("books.reader.find");
  const [text, setText] = useState("");
  const query = useDebouncedValue(text.trim(), SEARCH_DELAY_MS);
  const enabled = open && searchable && query.length >= BOOK_SEARCH_MIN_LENGTH;
  const results = useQuery({ ...bookQueries.search(bookId, query), enabled });
  const typing = text.trim() !== query;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t("title")} placement="right">
      {!searchable ? (
        <EmptyState icon={SearchX}>{t("unavailable")}</EmptyState>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            {t("label")}
            <Input
              type="search"
              autoFocus
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={t("placeholder")}
              maxLength={100}
              autoComplete="off"
            />
          </label>

          <div aria-live="polite" className="min-h-0 flex-1">
            {text.trim().length < BOOK_SEARCH_MIN_LENGTH && (
              <p className="text-muted text-sm">{t("hint")}</p>
            )}

            {enabled && (results.isPending || typing) && (
              <div className="flex flex-col gap-2" role="status" aria-label={t("searching")}>
                {Array.from({ length: 4 }, (_, index) => (
                  <Skeleton key={index} className="h-14 rounded-lg" />
                ))}
              </div>
            )}

            {enabled && results.isError && <p className="text-danger text-sm">{t("error")}</p>}

            {enabled && results.isSuccess && !typing && results.data.length === 0 && (
              <p className="text-muted text-sm">{t("none", { query })}</p>
            )}

            {enabled && results.isSuccess && !typing && results.data.length > 0 && (
              <>
                <p className="text-muted mb-2 text-sm">
                  {t("count", { count: results.data.length })}
                </p>
                <ul className="flex flex-col gap-1">
                  {results.data.map((hit) => (
                    <li key={hit.page}>
                      <button
                        type="button"
                        onClick={() => {
                          onGo(hit.page);
                          onOpenChange(false);
                        }}
                        className="hover:bg-subtle flex w-full flex-col gap-0.5 rounded-lg px-3 py-2.5 text-left transition-colors"
                      >
                        <span className="text-link text-sm font-semibold">
                          {t("result", { page: hit.page })}
                        </span>
                        <span className="text-foreground text-[0.9375rem] leading-snug">
                          {splitMatches(hit.snippet, query).map((part, index) =>
                            part.match ? (
                              <mark
                                key={index}
                                className="bg-accent-100 text-foreground rounded-sm px-0.5"
                              >
                                {part.text}
                              </mark>
                            ) : (
                              <span key={index}>{part.text}</span>
                            ),
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}
