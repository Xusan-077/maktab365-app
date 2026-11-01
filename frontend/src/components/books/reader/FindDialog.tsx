"use client";

import { useEffect, useState } from "react";
import { SearchX } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  FIND_MIN_LENGTH,
  normalizeTerm,
  searchDocument,
  type FindableDocument,
  type PageHit,
} from "@/lib/pdf/find";

const SEARCH_DELAY_MS = 350;

/** Natija `term` bilan bog'langan: so'z o'zgarsa eskisi avtomatik "yo'q" hisoblanadi. */
type SearchState =
  | { term: string; status: "running"; hits: PageHit[] }
  | { term: string; status: "done"; hits: PageHit[] }
  | { term: string; status: "error" };

export interface FindDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** PDF.js hujjati; yuklanguncha `null`. */
  doc: FindableDocument | null;
  /** Kitobda matn qatlami bor (skanerlangan kitobda qidiruv ishlamaydi). */
  searchable: boolean;
  onGo: (page: number, term: string) => void;
}

/**
 * Kitob ichida qidirish (PDF.js `getTextContent`): so'z kiritilgach sahifalar ketma-ket o'qiladi,
 * natijalar topilgan sari chiqadi; tanlansa o'sha betga o'tadi va so'z belgilanadi. Skaner (matn
 * yo'q) kitobda — "qidiruv mavjud emas".
 */
export function FindDialog({ open, onOpenChange, doc, searchable, onGo }: FindDialogProps) {
  const t = useTranslations("books.reader.find");
  const [text, setText] = useState("");
  const term = useDebouncedValue(text.trim(), SEARCH_DELAY_MS);
  const [state, setState] = useState<SearchState | null>(null);
  const [scannedDoc, setScannedDoc] = useState(false);
  const enabled = open && searchable && !scannedDoc && Boolean(doc);
  const valid = normalizeTerm(term).length >= FIND_MIN_LENGTH;
  const typing = text.trim() !== term;

  useEffect(() => {
    if (!enabled || !doc || !valid) return;
    const abort = new AbortController();
    searchDocument(doc, term, {
      signal: abort.signal,
      onProgress: (_page, found) => {
        if (!abort.signal.aborted) setState({ term, status: "running", hits: [...found] });
      },
    })
      .then((result) => {
        if (abort.signal.aborted) return;
        if (result.scanned) setScannedDoc(true);
        setState({ term, status: "done", hits: result.hits });
      })
      .catch(() => {
        if (!abort.signal.aborted) setState({ term, status: "error" });
      });
    return () => abort.abort();
  }, [enabled, doc, term, valid]);

  const unavailable = !searchable || scannedDoc;
  const search = valid && state?.term === term ? state : null;
  const hits = search && search.status !== "error" ? search.hits : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t("title")} placement="right">
      {unavailable ? (
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

          <div aria-live="polite" className="min-h-0 flex-1 overflow-y-auto">
            {normalizeTerm(text).length < FIND_MIN_LENGTH && (
              <p className="text-muted text-sm">{t("hint")}</p>
            )}

            {valid && (!search || search.status === "running") && hits.length === 0 && (
              <div className="flex flex-col gap-2" role="status" aria-label={t("searching")}>
                {Array.from({ length: 4 }, (_, index) => (
                  <Skeleton key={index} className="h-14 rounded-lg" />
                ))}
              </div>
            )}

            {search?.status === "error" && <p className="text-danger text-sm">{t("error")}</p>}

            {!typing && search?.status === "done" && hits.length === 0 && (
              <p className="text-muted text-sm">{t("none", { query: term })}</p>
            )}

            {valid && !typing && hits.length > 0 && (
              <>
                <p className="text-muted mb-2 text-sm">{t("count", { count: hits.length })}</p>
                <ul className="flex flex-col gap-1">
                  {hits.map((hit) => (
                    <li key={hit.page}>
                      <button
                        type="button"
                        onClick={() => {
                          onGo(hit.page, term);
                          onOpenChange(false);
                        }}
                        className="hover:bg-subtle flex w-full flex-col gap-0.5 rounded-lg px-3 py-2.5 text-left transition-colors"
                      >
                        <span className="text-link text-sm font-semibold">
                          {t("result", { page: hit.page })}
                        </span>
                        <span className="text-foreground text-[0.9375rem] leading-snug">
                          {hit.before}
                          <mark className="bg-accent-100 text-foreground rounded-sm px-0.5">
                            {hit.match}
                          </mark>
                          {hit.after}
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
