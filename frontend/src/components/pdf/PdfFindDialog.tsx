"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import {
  FIND_MAX_PAGES,
  FIND_MIN_LENGTH,
  normalizeTerm,
  searchDocument,
  type FindableDocument,
  type PageHit,
} from "@/lib/pdf/find";

export interface PdfFindDialogProps {
  doc: FindableDocument;
  initialTerm?: string;
  onOpenChange: (open: boolean) => void;
  /** Natija tanlandi: shu betga o'tiladi va so'z belgilanadi. */
  onPick: (page: number, term: string) => void;
}

type Status =
  | { kind: "idle" }
  | { kind: "running"; page: number }
  | { kind: "done"; scanned: boolean; complete: boolean };

/**
 * Kitob ichida qidiruv (pdf.js matn qatlami): so'z kiritilib Enter bosilganda sahifalar ketma-ket
 * o'qiladi, natijalar sahifa bo'yicha ro'yxatda. Skaner (matn yo'q) PDF uchun aniq xabar.
 */
export function PdfFindDialog({ doc, initialTerm = "", onOpenChange, onPick }: PdfFindDialogProps) {
  const t = useTranslations("pdfBooks.find");
  const [input, setInput] = useState(initialTerm);
  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<PageHit[]>([]);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const controller = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tooShort = normalizeTerm(input).length < FIND_MIN_LENGTH;

  useEffect(() => {
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      controller.current?.abort();
    };
  }, []);

  const run = async (event: FormEvent) => {
    event.preventDefault();
    if (tooShort) return;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const current = input.trim();
    setTerm(current);
    setHits([]);
    setStatus({ kind: "running", page: 0 });
    const result = await searchDocument(doc, current, {
      signal: abort.signal,
      onProgress: (page, found) => {
        if (abort.signal.aborted) return;
        setStatus({ kind: "running", page });
        setHits([...found]);
      },
    });
    if (abort.signal.aborted) return;
    setHits(result.hits);
    setStatus({ kind: "done", scanned: result.scanned, complete: result.complete });
  };

  return (
    <Dialog open onOpenChange={onOpenChange} title={t("title")} className="sm:max-w-xl">
      <form role="search" onSubmit={run} className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            className="text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <input
            ref={inputRef}
            type="search"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            aria-label={t("label")}
            placeholder={t("placeholder")}
            autoComplete="off"
            data-testid="pdf-find-input"
            className="border-border bg-surface placeholder:text-muted h-11 w-full rounded-lg border pr-3 pl-9 text-base"
          />
        </div>
        <Button type="submit" disabled={tooShort} data-testid="pdf-find-submit">
          {t("search")}
        </Button>
      </form>

      <div aria-live="polite" className="flex min-h-16 flex-col gap-3">
        {status.kind === "idle" && <p className="text-muted text-sm">{t("hint")}</p>}
        {status.kind === "running" && (
          <p className="text-muted text-sm tabular-nums">
            {t("searching", { page: status.page, total: doc.numPages })}
          </p>
        )}
        {status.kind === "done" && status.scanned && (
          <p role="alert" className="text-sm" data-testid="pdf-find-scanned">
            {t("scanned")}
          </p>
        )}
        {status.kind === "done" && !status.scanned && hits.length === 0 && (
          <p className="text-muted text-sm">{t("none", { term })}</p>
        )}
        {hits.length > 0 && (
          <>
            <p className="text-muted text-sm tabular-nums">{t("found", { count: hits.length })}</p>
            <ul className="-mx-2 max-h-[50dvh] overflow-y-auto" data-testid="pdf-find-results">
              {hits.map((hit) => (
                <li key={hit.page}>
                  <button
                    type="button"
                    onClick={() => onPick(hit.page, term)}
                    className="hover:bg-subtle flex min-h-11 w-full flex-col gap-0.5 rounded-lg px-2 py-2 text-left"
                  >
                    <span className="text-sm font-medium tabular-nums">
                      {t("page", { page: hit.page })}
                      {hit.count > 1 && (
                        <span className="text-muted font-normal">
                          {" "}
                          · {t("times", { count: hit.count })}
                        </span>
                      )}
                    </span>
                    <span className="text-muted text-sm">
                      {hit.before}
                      <mark className="bg-accent-soft text-accent-soft-foreground rounded-sm px-0.5">
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
        {status.kind === "done" && !status.complete && !status.scanned && (
          <p className="text-muted text-sm">{t("limit", { count: FIND_MAX_PAGES })}</p>
        )}
      </div>
    </Dialog>
  );
}
