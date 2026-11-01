"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BookOpenText, Images, Share2, WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { OfflineButton, type OfflineButtonBook } from "@/components/pdf/OfflineButton";
import { PdfBookmarkButton } from "@/components/pdf/PdfBookmarkButton";
import { PdfSlidesViewer } from "@/components/pdf/PdfSlidesViewer";
import { ThumbnailStrip } from "@/components/pdf/reader/ThumbnailStrip";
import { ReportErrorLink } from "@/components/support/ReportErrorLink";
import { TopicPanel, type TopicTab } from "@/components/topic/TopicPanel";
import { Dialog } from "@/components/ui/Dialog";
import { OverflowMenu, type OverflowMenuItem } from "@/components/ui/OverflowMenu";
import { BK_ICON_BUTTON } from "@/components/books/reader/reader-styles";
import { parseSlidesParams, readSlidesProgress, withSlidesParams } from "@/lib/pdf/slides";
import { currentTocItem, flattenToc, type TocChapter } from "@/lib/pdf/toc";
import type { PDFDocumentProxy } from "@/lib/pdf/pdfjs";
import type { ReaderContext } from "@/lib/reader/source";

export interface TextbookExtrasProps {
  bookId: string;
  title: string;
  chapters: readonly TocChapter[];
  doc: PDFDocumentProxy | null;
  /** Oflayn saqlash: admin ko'rishida (`backHref` berilganda) yo'q. */
  offlineBook: OfflineButtonBook | null;
}

/** Darslik qo'shimchalarining umumiy holati: yuqori paneldagi tugmalar va ustki qatlamlar bitta holatdan foydalanadi. */
export function useTextbookExtras({ chapters, offlineBook }: TextbookExtrasProps) {
  const searchParams = useSearchParams();
  const [topicOpen, setTopicOpen] = useState(false);
  const [topicTab, setTopicTab] = useState<TopicTab>("summary");
  const [pagesOpen, setPagesOpen] = useState(false);
  const [offlineOpen, setOfflineOpen] = useState(false);
  const tocItems = useMemo(() => flattenToc(chapters), [chapters]);

  // `?slides=<bo'lim id>&slide=N`: o'qish oynasining o'z URL'ida (`bet` saqlanadi).
  const slidesParams = parseSlidesParams(searchParams);
  const slidesItem = useMemo(
    () =>
      slidesParams.chapterId
        ? tocItems.find((item) => item.id === slidesParams.chapterId && item.slides)
        : undefined,
    [slidesParams.chapterId, tocItems],
  );
  const replaceQuery = useCallback(
    (patch: Parameters<typeof withSlidesParams>[1]) =>
      window.history.replaceState(null, "", `?${withSlidesParams(searchParams, patch)}`),
    [searchParams],
  );
  const openSlides = useCallback(
    (chapterId: string, start: number) => replaceQuery({ slides: chapterId, slide: start }),
    [replaceQuery],
  );
  const closeSlides = useCallback(
    () => replaceQuery({ slides: null, slide: null }),
    [replaceQuery],
  );

  const share = useCallback((title: string) => {
    const url = window.location.href;
    if (typeof navigator.share === "function") {
      void navigator.share({ title, url }).catch(() => undefined);
    } else {
      void navigator.clipboard?.writeText(url).catch(() => undefined);
    }
  }, []);

  return {
    tocItems,
    topicOpen,
    setTopicOpen,
    topicTab,
    setTopicTab,
    pagesOpen,
    setPagesOpen,
    offlineOpen,
    setOfflineOpen,
    slidesParams,
    slidesItem,
    replaceQuery,
    openSlides,
    closeSlides,
    share,
    hasOffline: Boolean(offlineBook),
  };
}

/** Darslik uchun yuqori paneldagi tugmalar: Mavzu, Saqlash va «Yana» menyusi. */
export type TextbookExtrasState = ReturnType<typeof useTextbookExtras>;

export function TextbookActions({
  context,
  state,
  ...props
}: TextbookExtrasProps & { context: ReaderContext; state: TextbookExtrasState }) {
  const { title, doc, offlineBook } = props;
  const t = useTranslations("pdfBooks.reader");
  const current = currentTocItem(state.tocItems, context.page);

  const items: OverflowMenuItem[] = [
    ...(doc
      ? [
          {
            id: "pages",
            label: t("pages"),
            icon: <Images className="size-4" />,
            onSelect: () => state.setPagesOpen(true),
            testId: "pdf-pages",
          },
        ]
      : []),
    ...(offlineBook
      ? [
          {
            id: "offline",
            label: t("offline"),
            icon: <WifiOff className="size-4" />,
            onSelect: () => state.setOfflineOpen(true),
            testId: "pdf-offline",
          },
        ]
      : []),
    {
      id: "share",
      label: t("share"),
      icon: <Share2 className="size-4" />,
      onSelect: () => state.share(title),
      testId: "pdf-share",
    },
  ];

  return (
    <>
      {current && (
        <button
          type="button"
          className={BK_ICON_BUTTON}
          onClick={() => state.setTopicOpen(true)}
          aria-label={t("topic")}
          title={t("topic")}
          data-testid="pdf-topic"
        >
          <BookOpenText className="size-5" aria-hidden />
        </button>
      )}
      <PdfBookmarkButton bookId={props.bookId} compact />
      <OverflowMenu items={items} label={t("more")} testId="pdf-more" />
    </>
  );
}

/** Darslik uchun ustki qatlamlar: Mavzu paneli, taqdimot ko'rgichi, sahifalar lentasi, oflayn oynasi. */
export function TextbookOverlays({
  context,
  state,
  ...props
}: TextbookExtrasProps & { context: ReaderContext; state: TextbookExtrasState }) {
  const { bookId, doc, offlineBook } = props;
  const t = useTranslations("pdfBooks.reader");
  const current = currentTocItem(state.tocItems, context.page);
  const { slidesParams, slidesItem } = state;

  return (
    <>
      {current && (
        <TopicPanel
          open={state.topicOpen}
          onOpenChange={state.setTopicOpen}
          tab={state.topicTab}
          onTabChange={state.setTopicTab}
          topic={{ id: current.id, title: current.title }}
          bookId={bookId}
          slides={current.slides ?? null}
          onOpenSlides={() => {
            state.setTopicOpen(false);
            state.openSlides(current.id, readSlidesProgress(current.id) ?? 1);
          }}
          desktop={context.isDesktop}
        />
      )}

      {doc && (
        <Dialog
          open={state.pagesOpen}
          onOpenChange={state.setPagesOpen}
          title={t("pages")}
          placement="bottom"
        >
          {state.pagesOpen && (
            <ThumbnailStrip
              doc={doc}
              page={context.page}
              total={context.total}
              className="-mx-3"
              onGo={(next) => {
                state.setPagesOpen(false);
                context.go(next);
              }}
            />
          )}
        </Dialog>
      )}

      {offlineBook && (
        <Dialog
          open={state.offlineOpen}
          onOpenChange={state.setOfflineOpen}
          title={t("offline")}
          placement={context.isDesktop ? "center" : "bottom"}
        >
          <OfflineButton book={offlineBook} />
        </Dialog>
      )}

      {slidesItem?.slides && slidesParams.chapterId && slidesParams.slide !== null && (
        <PdfSlidesViewer
          key={slidesParams.chapterId}
          bookId={bookId}
          chapterId={slidesParams.chapterId}
          title={slidesItem.title}
          slideCount={slidesItem.slides.page_count}
          slide={slidesParams.slide}
          onSlide={(slide) => state.replaceQuery({ slide })}
          onClose={state.closeSlides}
          onBackToBook={() => {
            state.closeSlides();
            context.go(slidesItem.page);
          }}
        />
      )}

      <div className="pointer-events-none absolute right-3 bottom-[4.75rem] z-10 hidden lg:block">
        <div className="pointer-events-auto">
          <ReportErrorLink topicId={bookId} page={context.page} />
        </div>
      </div>
    </>
  );
}
