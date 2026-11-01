"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useLibraryBookDocument } from "@/components/pdf/usePdfDocument";
import { useAnnotationLoader } from "@/hooks/useAnnotationLoader";
import { useAnnotationSync } from "@/hooks/useAnnotationSync";
import { useAuth } from "@/hooks/useAuth";
import { useBookBookmarks } from "@/hooks/useBookBookmarks";
import { useBookProgress } from "@/hooks/useBookProgress";
import { useFullscreen } from "@/hooks/useFullscreen";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useTestSheet } from "@/hooks/useTestSheet";
import { useToast } from "@/hooks/useToast";
import type { AnnotationTool } from "@/lib/books/annotations";
import type { SheetState } from "@/lib/books/workspace";
import type { BookDetail } from "@/lib/books/api";
import { currentChapter, effectiveView, stepPage } from "@/lib/books/reader";
import { clampPage, parsePageParam } from "@/lib/pdf/page-nav";
import { clampZoom, DEFAULT_ZOOM, MAX_ZOOM } from "@/lib/pdf/zoom";
import {
  selectCanRedo,
  selectCanUndo,
  selectPageItems,
  useBookAnnotationsStore,
} from "@/stores/book-annotations.store";
import { useBookReaderStore } from "@/stores/book-reader.store";
import { useBookWorkspaceStore } from "@/stores/book-workspace.store";
import { BookReaderSkeleton } from "./BookReaderSkeleton";
import { FindDialog } from "./FindDialog";
import { PageView } from "./PageView";
import { ReaderBottomBar, ReaderTopBar } from "./ReaderBars";
import { TextView } from "./TextView";
import { TocDialog } from "./TocDialog";
import { useIdleChrome } from "./useIdleChrome";
import { AnswerSheetPanel } from "./modes/AnswerSheetPanel";
import { QuickAnswerBar } from "./modes/QuickAnswerBar";
import { SolutionDialog } from "./modes/SolutionDialog";
import { SolutionList } from "./modes/SolutionList";
import { useSolutionEditor } from "./modes/useSolutionEditor";
import { AnnotationCanvas } from "./workspace/AnnotationCanvas";
import { NotesAside } from "./workspace/NotesAside";
import { ReaderWatermark } from "@/components/reader/ReaderWatermark";
import { useReaderProtection } from "@/hooks/useReaderProtection";
import { NOTE_TAB, NotesPanel, type NotesTab } from "./workspace/NotesPanel";
import { NotesSheet } from "./workspace/NotesSheet";
import { ToolBar } from "./workspace/ToolBar";

const ZOOM_STEP = 0.5;

const subscribeHydration = (callback: () => void) =>
  useBookReaderStore.persist.onFinishHydration(callback);
const isHydrated = () => useBookReaderStore.persist.hasHydrated();

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}

export interface BookReaderProps {
  book: BookDetail;
}

/**
 * Kitob o'qish oynasi: PDF.js bilan chizilgan bet (yoki matnli rejim), tepa/pastki panel (o'zi
 * yashiriladi), mundarija + xatcho'plar, kitob ichida qidirish, zoom, to'liq ekran, klaviatura va
 * swipe. Oxirgi bet avtomatik saqlanadi (kirgan — server, mehmon — brauzer); URL'da `?bet=N`.
 */
export function BookReader({ book }: BookReaderProps) {
  const pdf = useLibraryBookDocument(book.id);
  const total = pdf.doc?.numPages ?? book.page_count;
  const searchParams = useSearchParams();
  const root = useRef<HTMLDivElement>(null);
  useReaderProtection(root);
  const pageScroller = useRef<HTMLDivElement>(null);
  const fullscreen = useFullscreen(root);
  const hydrated = useSyncExternalStore(subscribeHydration, isHydrated, () => false);
  const progress = useBookProgress(book.id);
  const bookmarks = useBookBookmarks(book.id);
  const view = useBookReaderStore((state) => state.view);
  const theme = useBookReaderStore((state) => state.theme);
  const font = useBookReaderStore((state) => state.font);
  const fontSize = useBookReaderStore((state) => state.fontSize);
  const lineHeight = useBookReaderStore((state) => state.lineHeight);
  const setView = useBookReaderStore((state) => state.setView);

  const t = useTranslations("books.workspace");
  const modeT = useTranslations("books");
  const { toast } = useToast();
  const { signedIn } = useAuth();
  const requireAuth = useRequireAuth();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const workspace = useBookWorkspaceStore();
  const tool = useBookAnnotationsStore((state) => state.tool);
  const selectedId = useBookAnnotationsStore((state) => state.selectedId);
  const drawMode = tool !== "none";
  const [sheet, setSheet] = useState<SheetState>("closed");
  // Kitob turiga xos rejimlar: faqat `math` va `test`; boshqa turlar o'zgarmaydi.
  const mathMode = book.reading_mode === "math";
  const testMode = book.reading_mode === "test";
  const [notesTab, setNotesTab] = useState<string>(NOTE_TAB);
  const testSheet = useTestSheet(book.id, testMode && signedIn);

  const [tocOpen, setTocOpen] = useState(false);
  const [tocTab, setTocTab] = useState<"contents" | "bookmarks">("contents");
  const [findOpen, setFindOpen] = useState(false);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [lookOpen, setLookOpen] = useState(false);
  const chrome = useIdleChrome(tocOpen || findOpen || lookOpen || drawMode);

  // Boshlang'ich bet: URL (`?bet=`) > saqlangan oxirgi bet > 1. Saqlangan bet aniqlangach bir marta.
  const [start, setStart] = useState<number | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  if (start === null && hydrated && progress.ready) {
    const fromUrl = parsePageParam(searchParams.get("bet"), total);
    setStart(fromUrl ?? clampPage(progress.lastPage ?? 1, total));
  }
  const page = chosen ?? start;
  const currentPage = page ?? 1;

  const sync = useAnnotationSync();
  useEffect(() => {
    useBookAnnotationsStore.getState().attach(book.id);
    return () => {
      // Boshqa sahifada (masalan, "Mening yozuvlarim") o'zgargan yozuvlar eskirgan nusxa bo'lib qolmasin.
      useBookAnnotationsStore.setState({
        bookId: null,
        tool: "none",
        selectedId: null,
        pages: {},
        lastChange: null,
      });
    };
  }, [book.id]);
  const annotationsState = useAnnotationLoader(book.id, currentPage, total);
  const pageItems = useBookAnnotationsStore(selectPageItems(currentPage));
  const canUndo = useBookAnnotationsStore(selectCanUndo(currentPage));
  const canRedo = useBookAnnotationsStore(selectCanRedo(currentPage));
  const notesOpen = isDesktop ? workspace.notesOpen : sheet !== "closed";

  // Matn qatlami: backend yuklashda aniqlaydi (`null` — eski yozuv, noma'lum: mavjud deb olinadi).
  const hasText = book.has_text_layer !== false;
  const [highlight, setHighlight] = useState("");
  const activeView = effectiveView(view, hasText);
  const { save } = progress;

  const go = useCallback(
    (target: number, term = "") => {
      setChosen(clampPage(target, total));
      setZoom(DEFAULT_ZOOM);
      setHighlight(term);
    },
    [total],
  );
  const step = useCallback(
    (direction: 1 | -1) => {
      setChosen((current) => stepPage(current ?? 1, total, direction));
      setHighlight("");
    },
    [total],
  );
  const changeZoom = useCallback((value: number) => {
    setZoom(Math.min(MAX_ZOOM, Math.max(DEFAULT_ZOOM, clampZoom(value))));
  }, []);

  // Joriy bet URL'ga va saqlashga yoziladi (sahifa yangilansa / havola ulashilsa shu betdan ochiladi).
  useEffect(() => {
    if (page === null) return;
    const url = new URL(window.location.href);
    url.searchParams.set("bet", String(page));
    window.history.replaceState(window.history.state, "", url);
    save(page);
  }, [page, save]);

  useEffect(() => {
    void useBookReaderStore.persist.rehydrate();
    void useBookWorkspaceStore.persist.rehydrate();
  }, []);

  // Bet almashganda tanlov bekor qilinadi.
  useEffect(() => {
    useBookAnnotationsStore.getState().select(null);
  }, [currentPage]);

  const { toggle: toggleBookmark } = bookmarks;
  const toggleBookmarkHere = useCallback(() => {
    if (page !== null) toggleBookmark(page);
  }, [page, toggleBookmark]);
  const openToc = useCallback((tab: "contents" | "bookmarks" = "contents") => {
    setTocTab(tab);
    setTocOpen(true);
  }, []);

  const textView = activeView === "text";
  const chooseTool = useCallback(
    (next: AnnotationTool) => {
      const apply = () => useBookAnnotationsStore.getState().setTool(next);
      if (next === "none") apply();
      else requireAuth(apply, "note");
    },
    [requireAuth],
  );
  const toggleNotes = useCallback(() => {
    if (isDesktop) workspace.toggleNotes();
    else setSheet((state) => (state === "closed" ? "half" : "closed"));
  }, [isDesktop, workspace]);
  const undo = useCallback(() => {
    if (page !== null) useBookAnnotationsStore.getState().undo(page);
  }, [page]);
  const redo = useCallback(() => {
    if (page !== null) useBookAnnotationsStore.getState().redo(page);
  }, [page]);
  const commitItems = useCallback(
    (items: Parameters<ReturnType<typeof useBookAnnotationsStore.getState>["commit"]>[1]) => {
      if (page !== null) useBookAnnotationsStore.getState().commit(page, items);
    },
    [page],
  );
  const panPage = useCallback((dx: number, dy: number) => {
    pageScroller.current?.scrollBy({ left: dx, top: dy });
  }, []);
  const notifyLimit = useCallback(() => toast({ variant: "error", title: t("limit") }), [toast, t]);
  const solutions = useSolutionEditor({
    items: pageItems,
    onCommit: commitItems,
    onLimit: notifyLimit,
  });
  const openAnswerSheet = useCallback(() => {
    setNotesTab("answers");
    if (isDesktop) workspace.setNotesOpen(true);
    else setSheet((state) => (state === "closed" ? "half" : state));
  }, [isDesktop, workspace]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.metaKey || isTyping(event.target)) return;
      const lower = event.key.toLowerCase();
      if (event.ctrlKey) {
        if (lower === "f") {
          event.preventDefault();
          setFindOpen(true);
        } else if (lower === "z" && !tocOpen && !findOpen) {
          event.preventDefault();
          if (event.shiftKey) redo();
          else undo();
        } else if (lower === "y" && !tocOpen && !findOpen) {
          event.preventDefault();
          redo();
        }
        return;
      }
      if (tocOpen || findOpen) return;
      const key = event.key;
      const paging = !drawMode;
      if (paging && (key === "ArrowRight" || key === "PageDown")) step(1);
      else if (paging && (key === "ArrowLeft" || key === "PageUp")) step(-1);
      else if (paging && key === "Home") go(1);
      else if (paging && key === "End") go(total);
      else if (key === "+" || key === "=") changeZoom(zoom + ZOOM_STEP);
      else if (key === "-") changeZoom(zoom - ZOOM_STEP);
      else if (key === "0") changeZoom(DEFAULT_ZOOM);
      else if (lower === "f") fullscreen.toggle();
      else if (lower === "m") openToc();
      else if (lower === "b") toggleBookmarkHere();
      else if (lower === "n") toggleNotes();
      else if (!textView && lower === "p") chooseTool("pen");
      else if (!textView && lower === "h") chooseTool("highlight");
      else if (!textView && lower === "t") chooseTool("text");
      else if (!textView && mathMode && lower === "y") chooseTool("solution");
      else if (!textView && lower === "e") chooseTool("eraser");
      else if (!textView && lower === "v") chooseTool("select");
      else if (drawMode && key === "Escape") chooseTool("none");
      else if (drawMode && selectedId && (key === "Delete" || key === "Backspace")) {
        const { pages, commit: commitPage } = useBookAnnotationsStore.getState();
        commitPage(
          currentPage,
          (pages[currentPage]?.items ?? []).filter((item) => item.id !== selectedId),
        );
        useBookAnnotationsStore.getState().select(null);
      } else if (key === "/") setFindOpen(true);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    step,
    go,
    total,
    changeZoom,
    zoom,
    fullscreen,
    openToc,
    toggleBookmarkHere,
    tocOpen,
    findOpen,
    drawMode,
    textView,
    mathMode,
    selectedId,
    currentPage,
    chooseTool,
    toggleNotes,
    undo,
    redo,
  ]);

  if (page === null) return <BookReaderSkeleton />;

  const chapter = currentChapter(book.chapters, page);

  return (
    <div
      ref={root}
      data-book-reader
      data-book-theme={theme}
      data-draw-mode={drawMode || undefined}
      className="bg-bk-stage text-bk-ink relative flex h-dvh flex-col overflow-hidden lg:flex-row"
    >
      <ReaderWatermark />
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        {activeView === "text" ? (
          <TextView
            doc={pdf.doc}
            docError={Boolean(pdf.error)}
            onReload={pdf.reload}
            page={page}
            prefs={{ font, fontSize, lineHeight }}
            onStep={step}
            onTap={chrome.toggle}
            onShowPage={() => setView("page")}
          />
        ) : (
          <PageView
            title={book.title}
            doc={pdf.doc}
            docLoading={pdf.loading}
            docError={Boolean(pdf.error)}
            onReload={pdf.reload}
            page={page}
            total={total}
            highlight={highlight}
            zoom={zoom}
            onZoomChange={changeZoom}
            onStep={step}
            onTap={chrome.toggle}
            drawMode={drawMode}
            scrollerRef={pageScroller}
            overlay={(size) =>
              annotationsState.ready ? (
                <AnnotationCanvas
                  key={page}
                  size={size}
                  theme={theme}
                  tool={tool}
                  items={pageItems}
                  settings={{
                    penColor: workspace.penColor,
                    penWidth: workspace.penWidth,
                    highlightColor: workspace.highlightColor,
                    textColor: workspace.textColor,
                    textSize: workspace.textSize,
                  }}
                  selectedId={selectedId}
                  zoom={zoom}
                  onSelect={(id) => useBookAnnotationsStore.getState().select(id)}
                  onCommit={commitItems}
                  onZoomChange={changeZoom}
                  onPan={panPage}
                  onLimit={notifyLimit}
                  onSolution={mathMode ? solutions.start : undefined}
                />
              ) : null
            }
          />
        )}

        <ReaderTopBar
          visible={chrome.visible}
          bookId={book.id}
          title={book.title}
          chapterTitle={chapter?.title ?? null}
          bookmarked={bookmarks.isBookmarked(page)}
          fullscreen={fullscreen}
          prefs={{ view: activeView, theme, font, fontSize, lineHeight }}
          hasText={hasText}
          notesOpen={notesOpen}
          onToggleNotes={toggleNotes}
          onLookOpenChange={setLookOpen}
          onOpenToc={() => openToc()}
          onOpenFind={() => setFindOpen(true)}
          onToggleBookmark={toggleBookmarkHere}
          page={page}
        />
        <ReaderBottomBar
          visible={chrome.visible}
          page={page}
          total={total}
          chapterTitle={(target) => currentChapter(book.chapters, target)?.title ?? null}
          zoom={activeView === "page" ? zoom : null}
          onZoom={(direction) => changeZoom(zoom + direction * ZOOM_STEP)}
          onZoomReset={() => changeZoom(DEFAULT_ZOOM)}
          onGo={go}
        />

        {testMode && !textView && signedIn && testSheet.sheet && (
          <QuickAnswerBar
            sheet={testSheet.sheet}
            page={page}
            answers={testSheet.answers}
            progress={testSheet.progress}
            onOpenSheet={openAnswerSheet}
            onAnswer={testSheet.setAnswer}
          />
        )}

        {!textView && (
          <ToolBar
            tool={tool}
            settings={{
              penColor: workspace.penColor,
              penWidth: workspace.penWidth,
              highlightColor: workspace.highlightColor,
              textColor: workspace.textColor,
              textSize: workspace.textSize,
            }}
            recentColors={workspace.recentColors}
            theme={theme}
            canUndo={canUndo}
            canRedo={canRedo}
            mathMode={mathMode}
            visible={chrome.visible}
            onToolChange={chooseTool}
            onUndo={undo}
            onRedo={redo}
            onPenColor={workspace.setPenColor}
            onPenWidth={workspace.setPenWidth}
            onHighlightColor={workspace.setHighlightColor}
            onTextColor={workspace.setTextColor}
            onTextSize={workspace.setTextSize}
          />
        )}
      </div>

      {(() => {
        const tabs: NotesTab[] = [];
        if (mathMode) {
          tabs.push({
            id: "solutions",
            label: modeT("math.tab"),
            content: (
              <SolutionList
                page={page}
                items={pageItems}
                signedIn={signedIn}
                onEdit={(id) => solutions.start({ kind: "edit", id })}
                onRequireAuth={() => requireAuth(undefined, "note")}
              />
            ),
          });
        }
        if (testMode) {
          tabs.push({
            id: "answers",
            label: modeT("test.tab"),
            content: (
              <AnswerSheetPanel
                bookId={book.id}
                signedIn={signedIn}
                sheet={testSheet}
                page={page}
                onGoPage={go}
                onRequireAuth={() => requireAuth(undefined, "note")}
              />
            ),
          });
        }
        const panel = (
          <NotesPanel
            tabs={tabs}
            tab={notesTab}
            onTabChange={setNotesTab}
            bookId={book.id}
            page={page}
            signedIn={signedIn}
            onRequireAuth={() => requireAuth(undefined, "note")}
            onRetrySave={() => void sync.flushNow()}
            onClose={isDesktop ? () => workspace.setNotesOpen(false) : () => setSheet("closed")}
          />
        );
        return isDesktop ? (
          workspace.notesOpen && (
            <NotesAside width={workspace.panelWidth} onWidthChange={workspace.setPanelWidth}>
              {panel}
            </NotesAside>
          )
        ) : (
          <NotesSheet state={sheet} onStateChange={setSheet}>
            {panel}
          </NotesSheet>
        );
      })()}

      {mathMode && (
        <SolutionDialog
          open={solutions.open !== null}
          editing={solutions.open?.id != null}
          initial={solutions.open?.draft ?? { title: "", body: "" }}
          page={page}
          onSave={solutions.save}
          onDelete={solutions.remove}
          onClose={solutions.close}
        />
      )}
      <TocDialog
        open={tocOpen}
        onOpenChange={setTocOpen}
        chapters={book.chapters}
        bookmarks={bookmarks.pages}
        page={page}
        onGo={go}
        onRemoveBookmark={toggleBookmark}
        tab={tocTab}
        onTabChange={setTocTab}
      />
      <FindDialog
        open={findOpen}
        onOpenChange={setFindOpen}
        doc={pdf.doc}
        searchable={hasText}
        onGo={go}
      />
    </div>
  );
}
