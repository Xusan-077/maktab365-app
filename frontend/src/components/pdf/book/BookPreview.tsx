"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { PdfPageCanvas } from "../PdfPageCanvas";
import { usePdfDocument } from "../usePdfDocument";

/** Namunada ko'rsatiladigan sahifalar soni (kitob qisqa bo'lsa kamroq). */
export const PREVIEW_PAGES = 4;

export const previewPageCount = (pageCount: number) => Math.min(PREVIEW_PAGES, pageCount);

function PreviewPages({ bookId, count }: { bookId: string; count: number }) {
  const t = useTranslations("pdfBooks.page.preview");
  const tr = useTranslations("pdfBooks.reader");
  const document = usePdfDocument(bookId);
  const [loaded, setLoaded] = useState(0);
  const failed = Boolean(document.error);

  if (failed) {
    return (
      <div role="alert" className="flex flex-col items-start gap-2">
        <p className="text-danger text-sm">{t("error")}</p>
        <Button variant="secondary" size="sm" onClick={document.reload}>
          {tr("retry")}
        </Button>
      </div>
    );
  }
  return (
    <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      {Array.from({ length: count }, (_, index) => index + 1).map((page) => (
        <li
          key={page}
          className="border-border bg-surface relative aspect-[1/1.35] w-40 shrink-0 snap-start overflow-hidden rounded-lg border sm:w-44"
        >
          {(!document.doc || page > loaded) && (
            <Skeleton className="absolute inset-0 rounded-none" />
          )}
          {document.doc && (
            <div className="absolute inset-0">
              <PdfPageCanvas
                doc={document.doc}
                pageNumber={page}
                label={t("pageLabel", { page })}
                onRendered={() => setLoaded((value) => Math.max(value, page))}
                onError={() => undefined}
              />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * Kitobdan namuna: birinchi sahifalar. pdf.js va fayl faqat blok ekranga yaqinlashganda yuklanadi
 * (sahifa ochilishi sekinlashmaydi); u tayyor bo'lguncha skeleton turadi.
 */
export function BookPreview({ bookId, pageCount }: { bookId: string; pageCount: number }) {
  const t = useTranslations("pdfBooks.page.preview");
  const count = previewPageCount(pageCount);
  const host = useRef<HTMLElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const element = host.current;
    if (!element || near) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [near]);

  if (count === 0) return null;
  return (
    <section ref={host} aria-labelledby="book-preview" className="flex flex-col gap-3">
      <div>
        <h2 id="book-preview" className="text-xl font-semibold tracking-tight">
          {t("title")}
        </h2>
        <p className="text-muted text-sm">{t("hint", { count })}</p>
      </div>
      {near ? (
        <PreviewPages bookId={bookId} count={count} />
      ) : (
        <div className="flex gap-3 overflow-hidden" aria-hidden>
          {Array.from({ length: count }, (_, i) => (
            <Skeleton key={i} className="aspect-[1/1.35] w-40 shrink-0 sm:w-44" />
          ))}
        </div>
      )}
    </section>
  );
}
