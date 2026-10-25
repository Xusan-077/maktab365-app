"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { PdfPageCanvas } from "@/components/pdf/PdfPageCanvas";
import { useSlidesDocument } from "@/components/pdf/usePdfDocument";
import { slidesById } from "@/lib/admin/chapters";
import { canDelete } from "@/lib/admin/permissions";
import type { AdminPdfBook, AdminSlides } from "@/lib/admin/types";
import type { PDFDocumentProxy } from "@/lib/pdf/pdfjs";
import { cn } from "@/lib/utils/cn";
import { useAdminIdentity } from "../AdminRoleProvider";
import { ChapterSlides } from "../ChapterSlides";

/** Eskiz ko'rinish maydoniga yaqinlashgandagina chiziladi (ko'p slaydli PDF'da xotira tejaladi). */
function LazyThumb({
  doc,
  page,
  selected,
  onSelect,
}: {
  doc: PDFDocumentProxy;
  page: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const t = useTranslations("admin.topic.slides");
  const ref = useRef<HTMLButtonElement>(null);
  // IntersectionObserver yo'q muhitda (eski brauzer, testlar) darhol chiziladi.
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === "undefined");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || visible) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setVisible(true);
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <li data-testid="slide-tile" className="relative">
      <button
        ref={ref}
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={t("select", { n: page })}
        className={cn(
          "border-border bg-subtle rounded-ds-sm block w-full overflow-hidden border-2 transition-shadow",
          selected ? "border-ds-accent ring-ds-accent/30 ring-4" : "hover:border-primary-300",
        )}
      >
        <span className="relative block aspect-video">
          {visible && !failed && (
            <PdfPageCanvas
              doc={doc}
              fit="contain"
              pageNumber={page}
              label={t("slideAlt", { n: page })}
              onError={() => setFailed(true)}
            />
          )}
        </span>
      </button>
      <span className="bg-ds-ink/80 pointer-events-none absolute top-1.5 left-1.5 rounded-md px-1.5 text-xs font-bold text-white tabular-nums">
        {page}
      </span>
    </li>
  );
}

/** Yuklangan PDF'ning haqiqiy slaydlari: katta ko'rinish va eskizlar to'ri. */
function SlidesPreview({
  bookId,
  chapterId,
  slides,
}: {
  bookId: string;
  chapterId: string;
  slides: AdminSlides;
}) {
  const t = useTranslations("admin.topic.slides");
  const { doc, error, reload } = useSlidesDocument(bookId, chapterId);
  const [selected, setSelected] = useState(1);
  const total = doc?.numPages ?? slides.page_count;
  const current = Math.min(Math.max(1, selected), Math.max(1, total));

  if (error) {
    return (
      <p role="alert" className="text-danger text-sm" data-testid="slides-preview-error">
        {t("previewError")}{" "}
        <button type="button" className="text-link underline" onClick={reload}>
          {t("retry")}
        </button>
      </p>
    );
  }

  return (
    <section aria-labelledby="slides-grid-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="slides-grid-title" className="text-foreground text-base font-semibold">
          {t("gridTitle")}
        </h2>
        <p className="text-muted text-sm" data-testid="slides-summary">
          {t("countPdf", { total })}
        </p>
      </div>
      {!doc ? (
        <div
          role="status"
          aria-label={t("previewLoading")}
          className="bg-subtle rounded-ds flex aspect-video max-w-3xl items-center justify-center"
        >
          <Loader2 className="text-muted size-6 animate-spin" aria-hidden />
        </div>
      ) : (
        <>
          <div
            className="bg-subtle rounded-ds relative aspect-video w-full max-w-3xl overflow-hidden"
            data-testid="slide-large"
          >
            <PdfPageCanvas
              key={current}
              doc={doc}
              fit="contain"
              pageNumber={current}
              label={t("slideAlt", { n: current })}
              onError={() => undefined}
            />
          </div>
          <ol
            className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-6"
            aria-label={t("gridTitle")}
          >
            {Array.from({ length: total }, (_, index) => (
              <LazyThumb
                key={index + 1}
                doc={doc}
                page={index + 1}
                selected={index + 1 === current}
                onSelect={() => setSelected(index + 1)}
              />
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

/**
 * Admin «Taqdimot»: bo'lim prezentatsiyasi (PDF slaydlar) — yuklash, almashtirish, o'chirish
 * (`ChapterSlides`) va yuklangan PDF'ning haqiqiy slaydlari. Prezentatsiya faqat shu yerda boshqariladi;
 * mundarija qatorida faqat holati ko'rinadi.
 */
export function PresentationEditor({
  book,
  topicId,
  title,
  position,
}: {
  book: AdminPdfBook;
  topicId: string;
  title: string;
  /** Mundarijadagi tartib raqami ("2" yoki "2.1"): tugma nomlari uchun. */
  position: string;
}) {
  const { role } = useAdminIdentity();
  const byId = slidesById(book.chapters ?? []);
  const slides = byId.get(topicId) ?? null;
  return (
    <div className="flex flex-col gap-6">
      <ChapterSlides
        manage
        context={{ bookId: book.id, byId, canDelete: canDelete(role) }}
        row={{ key: topicId, id: topicId, title, page: "" }}
        position={position}
      />
      {slides && (
        // Yangi fayl yuklansa (boshqa nom/vaqt) hujjat qaytadan ochiladi.
        <SlidesPreview
          key={`${slides.name}|${slides.updated_at}|${slides.size_bytes}`}
          bookId={book.id}
          chapterId={topicId}
          slides={slides}
        />
      )}
    </div>
  );
}
