"use client";

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import type { LiveZoom } from "@/hooks/useReaderZoom";
import type { PDFDocumentProxy } from "@/lib/pdf/pdfjs";
import { pageAtCenter, pageOffsets, renderWindow } from "@/lib/pdf/reading-mode";
import { cn } from "@/lib/utils/cn";

/** Betlar orasidagi bo'shliq (px). */
const GAP = 14;
/** Desktopda bet eni chegarasi (px). */
const MAX_WIDTH = 900;
/** Ko'rinayotgan bet ± shuncha bet canvas bilan chiziladi; qolgani — balandligi to'g'ri skeleton. */
const RENDER_RADIUS = 2;
/** O'lchami oldindan o'qiladigan betlar (± joriy): turli o'lchamli PDF'da ham joy sakramasin. */
const MEASURE_RADIUS = 6;
/** Joriy bet (toolbar, progress, URL) scroll to'xtagach shuncha ms dan keyin yangilanadi. */
const REPORT_DEBOUNCE_MS = 300;
/** A4 nisbati — 1-bet o'lchami kelguncha. */
const DEFAULT_ASPECT = 1.414;

export interface VerticalViewProps {
  doc: PDFDocumentProxy;
  /** URL'dagi bet: o'zgarsa (raqam, mundarija, belgi) shu betga silliq scroll qilinadi. */
  page: number;
  total: number;
  zoom: number;
  live: LiveZoom | null;
  /** Scroll konteyneri: oddiy holatda oyna, to'liq ekranda — stage. */
  fullscreen: boolean;
  stageRef: RefObject<HTMLElement | null>;
  scrollerRef: RefObject<HTMLDivElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
  /** Scroll natijasidagi joriy bet (debounce bilan). */
  onPageChange: (page: number) => void;
  /** `PdfPageCanvas` (`fit="width"`) — belgilar qatlami va qidiruv belgilari bilan. */
  renderPage: (pageNumber: number, options: { current: boolean }) => ReactNode;
}

/**
 * Vertikal (uzluksiz scroll) o'qish. Virtualizatsiya: barcha betlar o'rni (to'g'ri balandlikdagi
 * quti) DOM'da, lekin canvas faqat ekran markazidagi bet ±2 da — 240 betda ham ≤ 5 canvas. Bet
 * balandligi PDF o'lchamidan (1-bet — standart, atrofdagilar — haqiqiy), shuning uchun scroll
 * sakramaydi. Joriy bet — ekran markaziga eng yaqin bet.
 */
export function VerticalView({
  doc,
  page,
  total,
  zoom,
  live,
  fullscreen,
  stageRef,
  scrollerRef,
  contentRef,
  onPageChange,
  renderPage,
}: VerticalViewProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef(new Map<number, HTMLDivElement>());
  const [available, setAvailable] = useState(0);
  const [aspects, setAspects] = useState<{ base: number; pages: Map<number, number> }>({
    base: DEFAULT_ASPECT,
    pages: new Map(),
  });
  const [center, setCenter] = useState(page);

  // Mavjud en (konteyner) → bet eni: fit-width, desktopda 900px gacha, zoom bilan.
  useEffect(() => {
    const element = outerRef.current;
    if (!element) return;
    setAvailable(element.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setAvailable(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const baseWidth = Math.min(available || MAX_WIDTH, MAX_WIDTH);
  const pageWidth = Math.floor(baseWidth * zoom);

  // 1-bet nisbati — barcha betlar uchun standart.
  useEffect(() => {
    let cancelled = false;
    void doc
      .getPage(1)
      .then((first) => {
        const { width, height } = first.getViewport({ scale: 1 });
        if (!cancelled) setAspects((current) => ({ ...current, base: height / width }));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [doc]);

  // Joriy bet atrofidagi betlarning haqiqiy nisbati (standartdan farq qilsa).
  useEffect(() => {
    let cancelled = false;
    const { from, to } = renderWindow(center, total, MEASURE_RADIUS);
    void (async () => {
      const found = new Map<number, number>();
      for (let number = from; number <= to; number += 1) {
        if (aspects.pages.has(number)) continue;
        try {
          const proxy = await doc.getPage(number);
          const { width, height } = proxy.getViewport({ scale: 1 });
          found.set(number, height / width);
        } catch {
          // O'lcham o'qilmadi — standart nisbat qoladi.
        }
        if (cancelled) return;
      }
      if (cancelled || found.size === 0) return;
      setAspects((current) => {
        const pages = new Map(current.pages);
        let changed = false;
        for (const [number, aspect] of found) {
          if (!pages.has(number)) {
            pages.set(number, aspect);
            changed = true;
          }
        }
        return changed ? { ...current, pages } : current;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [doc, center, total, aspects.pages]);

  const heights = useMemo(
    () =>
      Array.from({ length: total }, (_, index) =>
        Math.round(pageWidth * (aspects.pages.get(index + 1) ?? aspects.base)),
      ),
    [total, pageWidth, aspects],
  );
  const layout = useMemo(() => pageOffsets(heights, GAP), [heights]);

  const scrollRoot = useCallback(
    (): HTMLElement | Window | null => (fullscreen ? stageRef.current : window),
    [fullscreen, stageRef],
  );

  // Dasturiy scroll (raqam/mundarija) paytida oraliq betlar URL'ga yozilmaydi.
  const target = useRef<{ page: number; until: number } | null>(null);
  const reported = useRef(page);
  const timer = useRef<number | undefined>(undefined);
  const report = useEffectEvent((next: number) => {
    window.clearTimeout(timer.current);
    if (target.current) return;
    timer.current = window.setTimeout(() => {
      if (next === reported.current) return;
      reported.current = next;
      onPageChange(next);
    }, REPORT_DEBOUNCE_MS);
  });

  const measure = useEffectEvent(() => {
    const list = contentRef.current;
    if (!list) return;
    const root = scrollRoot();
    const top =
      root instanceof HTMLElement
        ? root.getBoundingClientRect().top + root.clientHeight / 2
        : window.innerHeight / 2;
    const middle = top - list.getBoundingClientRect().top;
    const next = pageAtCenter(layout.tops, heights, middle);
    setCenter(next);
    const pending = target.current;
    if (pending && (next === pending.page || performance.now() > pending.until)) {
      target.current = null;
      reported.current = pending.page;
      if (next !== pending.page) report(next);
      return;
    }
    report(next);
  });

  useEffect(() => {
    const root = scrollRoot();
    if (!root) return;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.cancelAnimationFrame(frame);
      root.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [scrollRoot]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // URL'dagi bet tashqaridan o'zgarsa — o'sha betga scroll (birinchi ochilishda darhol, keyin silliq).
  const mounted = useRef(false);
  useLayoutEffect(() => {
    if (!available) return;
    const first = !mounted.current;
    mounted.current = true;
    if (!first && page === reported.current) return;
    reported.current = page;
    window.clearTimeout(timer.current);
    const slot = slotRefs.current.get(page);
    if (!slot) return;
    const smooth = !first && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    target.current = { page, until: performance.now() + (smooth ? 1500 : 300) };
    setCenter(page);
    slot.scrollIntoView?.({ behavior: smooth ? "smooth" : "auto", block: "start" });
  }, [page, available]);

  const { from, to } = renderWindow(center, total, RENDER_RADIUS);

  return (
    <div ref={outerRef} className="w-full" data-testid="pdf-vertical">
      <div ref={scrollerRef} className={cn((zoom > 1 || live) && "overflow-x-auto")}>
        <div
          ref={contentRef}
          data-testid="pdf-zoom-content"
          data-zoom={zoom}
          className="mx-auto flex flex-col"
          style={{
            width: pageWidth || undefined,
            gap: GAP,
            ...(live && { transform: `scale(${live.scale})`, transformOrigin: live.origin }),
          }}
        >
          {heights.map((height, index) => {
            const number = index + 1;
            const rendered = number >= from && number <= to;
            return (
              <div
                key={number}
                ref={(element) => {
                  if (element) slotRefs.current.set(number, element);
                  else slotRefs.current.delete(number);
                }}
                data-page-slot={number}
                className="relative scroll-mt-20 [overflow-anchor:auto]"
                style={{ height }}
              >
                {rendered ? (
                  renderPage(number, { current: number === page })
                ) : (
                  <div
                    aria-hidden
                    className="bg-surface/70 text-muted flex size-full items-center justify-center rounded-sm text-sm tabular-nums shadow-sm"
                  >
                    {number}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
