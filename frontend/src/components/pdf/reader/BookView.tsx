"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { m } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useBookZoom } from "@/hooks/useBookZoom";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  BOOK_PADDING,
  bookPageSize,
  bookSpread,
  DEFAULT_PAGE_ASPECT,
  flipDirection,
  isNeighbourFlip,
  prefersSimpleFlip,
  spreadPageNumbers,
  spreadRange,
  stackDepths,
  stackShadow,
  type BookSpread,
  type Size,
} from "@/lib/pdf/book";
import {
  clampCorner,
  cornerPath,
  cornerPoint,
  curlGeometry,
  flapLocalClip,
  flapTransform,
  polygonCss,
  type Corner,
  type Point,
} from "@/lib/pdf/page-curl";
import type { PDFDocumentProxy } from "@/lib/pdf/pdfjs";
import { isDoubleTap, type TapPoint } from "@/lib/pdf/reader-prefs";
import { nextSpread, prevSpread } from "@/lib/pdf/reading-mode";
import { PageRenderPool } from "@/lib/pdf/render-pool";
import { swipeDirection } from "@/lib/pdf/swipe";
import { cn } from "@/lib/utils/cn";
import { useReaderPrefsStore } from "@/stores/reader-prefs.store";

/** Qo'shni varaq ag'darish va uzoqqa sakrash (bitta tez varaq) davomiyligi, ms. */
const FLIP_MS = 700;
const JUMP_MS = 420;
/** Sudrab qo'yib yuborilgandan keyin varaq oxirigacha (yoki joyiga) shuncha ms da boradi. */
const RELEASE_MS = 320;
/** Joriy yoyma ± shuncha bet canvas bilan (ko'rinmas holda oldindan) chiziladi. */
const RENDER_RADIUS = 2;
/** Shuncha px siljigandan keyin bosish sudrashga aylanadi. */
const DRAG_THRESHOLD = 6;
/** Tez "silkitish" (px/ms): yarmiga yetmasa ham varaq ag'dariladi. */
const FLICK_SPEED = 0.45;
/** Pastdagi suzuvchi navigatsiya egallagan joy (px): stage undan yuqorida. */
const NAV_RESERVE = 72;
const EMPTY_CLIP = "polygon(0 0, 0 0, 0 0)";

export interface BookRenderOptions {
  current: boolean;
  align: "start" | "center" | "end";
  /** Ko'rinmas, oldindan chizilayotgan bet: xatosi o'quvchini to'xtatmaydi. */
  prefetch?: boolean;
  renderScale: number;
  pool: PageRenderPool;
  priority: number;
}

export interface BookViewProps {
  doc: PDFDocumentProxy;
  page: number;
  total: number;
  /** Ikki bet yonma-yon (≥1024px); aks holda bitta bet. */
  twoPage: boolean;
  /** O'ngdan ochilgan panel (Mavzu) egallagan joy, px: kitob qolgan joyga qayta moslanadi. */
  reserveRight?: number;
  onGo: (page: number) => void;
  /** `PdfPageCanvas` (`fit="contain"`, `variant="book"`) — belgilar va qidiruv qatlamlari bilan. */
  renderPage: (pageNumber: number, options: BookRenderOptions) => ReactNode;
  /** Stage elementi (matn belgilash menyusi shu maydonni kuzatadi). */
  areaRef?: (element: HTMLDivElement | null) => void;
}

type Role = "left" | "right" | "static" | "front" | "reveal" | "back" | "hidden";

interface Flip {
  /** Mantiqiy yo'nalish: `from` (joriy) → `to`. */
  from: BookSpread;
  to: BookSpread;
  /**
   * Geometriya doim "oldinga" (o'ng varaq chapga): orqaga ag'darish — `to → from` oldinga
   * ag'darishning teskari ijrosi (burchak chapdan o'ngga qaytadi).
   */
  reverse: boolean;
  corner: Corner;
  mode: "anim" | "drag";
  jump: boolean;
}

/** Geometriya bo'yicha betlar: `g0` — tekis (boshlanish), `g1` — to'liq ag'darilgan holat. */
function flipPages(flip: Flip) {
  const g0 = flip.reverse ? flip.to : flip.from;
  const g1 = flip.reverse ? flip.from : flip.to;
  return { stat: g0.left, front: g0.right, reveal: g1.right, back: g1.left };
}

function roleOf(pageNumber: number, rest: BookSpread, flip: Flip | null): Role {
  if (!flip) {
    if (pageNumber === rest.left) return "left";
    if (pageNumber === rest.right) return "right";
    return "hidden";
  }
  const pages = flipPages(flip);
  if (pageNumber === pages.front) return "front";
  if (pageNumber === pages.back) return "back";
  if (pageNumber === pages.stat) return "static";
  if (pageNumber === pages.reveal) return "reveal";
  return "hidden";
}

const LEFT_ROLES: Role[] = ["left", "static", "back"];
const Z_INDEX: Record<Role, number> = {
  hidden: 0,
  left: 1,
  right: 1,
  static: 1,
  reveal: 1,
  front: 2,
  back: 4,
};

/** Sudrash oyna chetidan chiqsa ham davom etsin (faol bo'lmagan pointer'da xato — e'tiborsiz). */
function capture(event: PointerEvent<HTMLElement>) {
  try {
    event.currentTarget.setPointerCapture(event.pointerId);
  } catch {
    // Pointer allaqachon tugagan — sudrash capture'siz davom etadi.
  }
}

function useSimpleFlip() {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [device] = useState(() => {
    if (typeof navigator === "undefined") return {};
    return {
      cores: navigator.hardwareConcurrency || undefined,
      memory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
    };
  });
  return prefersSimpleFlip({ reducedMotion, ...device });
}

/**
 * «Kitob» rejimi: ochiq kitob (≥1024px da ikki bet, muqova va juft kitobning oxirgi beti yolg'iz),
 * aks holda bitta bet. Varaq ag'darish — o'zimizning curl (`page-curl.ts`: buklanish chizig'i,
 * clip-path va affin transform, harakatdagi soya/yorug'lik): burchakni sudrash, chekkani bosish,
 * ← →, pastki navigatsiya, swipe. Uzoqqa sakrash — bitta tez varaq. Kitob stage markazida qotib
 * turadi (joylashuv o'lchami o'zgarmaydi), zoom/pan — faqat transform (`useBookZoom`). Canvas faqat
 * joriy yoyma ±2 betda, chizish navbati va LRU kesh — `PageRenderPool`.
 */
export function BookView({
  doc,
  page,
  total,
  twoPage,
  reserveRight = 0,
  onGo,
  renderPage,
  areaRef,
}: BookViewProps) {
  const t = useTranslations("pdfBooks.reader");
  const zoom = useReaderPrefsStore((state) => state.zoom);
  const setZoom = useReaderPrefsStore((state) => state.setZoom);
  const simple = useSimpleFlip();
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const bookRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef(new Map<number, HTMLDivElement>());
  const paperRef = useRef<HTMLDivElement>(null);
  const revealShadeRef = useRef<HTMLDivElement>(null);
  const flapShadeRef = useRef<HTMLDivElement>(null);

  const pool = useMemo(() => new PageRenderPool(doc), [doc]);
  // Unmount / hujjat almashganda: navbat bekor, keshdagi canvas'lar 0×0 (xotira qaytadi).
  useEffect(() => () => pool.clear(), [pool]);

  // 1-bet nisbati — kitob o'lchami (betlar shu qutiga `contain` bilan joylashadi).
  const [aspect, setAspect] = useState(DEFAULT_PAGE_ASPECT);
  useEffect(() => {
    let cancelled = false;
    void doc
      .getPage(1)
      .then((first) => {
        const { width, height } = first.getViewport({ scale: 1 });
        if (!cancelled && width > 0) setAspect(height / width);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [doc]);

  // Joylashuv o'lchami bir marta (nisbat yoki 1/2 bet o'zgarganda) hisoblanadi; keyin stage
  // o'zgarsa faqat «Moslash» masshtabi o'zgaradi — kitob qayta chizilmaydi va sakramaydi.
  const [base, setBase] = useState<{ key: string; size: Size } | null>(null);
  const layoutKey = `${aspect}|${twoPage}`;
  const layout = base ? bookPageSize(aspect, twoPage, base.size, BOOK_PADDING) : null;
  const W = layout?.width ?? 0;
  const H = layout?.height ?? 0;
  const bookSize = useMemo(() => ({ width: twoPage ? 2 * W : W, height: H }), [twoPage, W, H]);
  const spineX = twoPage ? W : 0;

  const view = useBookZoom({ stage, book: bookSize, zoom, setZoom, instant: simple });
  if (view.stageSize.width > 0 && view.stageSize.height > 0 && base?.key !== layoutKey) {
    setBase({ key: layoutKey, size: view.stageSize });
  }

  const target = bookSpread(page, total, twoPage);
  const [shown, setShown] = useState({ ...target, twoPage });
  const [flip, setFlip] = useState<Flip | null>(null);
  // 1 ↔ 2 bet almashganda (oyna o'lchami) — animatsiyasiz yangi yoyma.
  if (shown.twoPage !== twoPage) {
    setShown({ ...target, twoPage });
    setFlip(null);
  }
  const rest: BookSpread = shown;
  const flipRef = useRef(flip);
  useLayoutEffect(() => {
    flipRef.current = flip;
  });

  const nextStart = nextSpread(rest.start, total, twoPage);
  const prevStart = prevSpread(rest.start, twoPage);

  // ——— Kadr: burchak `P` (umurtqaga nisbatan) bo'yicha clip-path, transform va soyalar ———
  const applyFrame = useCallback(
    (current: Flip, point: Point) => {
      const pages = flipPages(current);
      const front = pages.front !== null ? slotRefs.current.get(pages.front) : undefined;
      const reveal = pages.reveal !== null ? slotRefs.current.get(pages.reveal) : undefined;
      const back = twoPage
        ? pages.back !== null
          ? slotRefs.current.get(pages.back)
          : undefined
        : paperRef.current;
      const geometry = curlGeometry(W, H, current.corner, point);
      if (front) front.style.clipPath = geometry ? polygonCss(geometry.front) : "none";
      if (reveal) reveal.style.clipPath = geometry ? polygonCss(geometry.cut) : EMPTY_CLIP;
      if (back) {
        back.style.transformOrigin = "0 0";
        back.style.transform = geometry ? `matrix(${flapTransform(geometry, W).join(",")})` : "";
        back.style.clipPath = geometry ? polygonCss(flapLocalClip(geometry, W)) : EMPTY_CLIP;
      }
      const shades = [
        { element: revealShadeRef.current, polygon: geometry?.cut, sign: 1 },
        { element: flapShadeRef.current, polygon: geometry?.flap, sign: -1 },
      ];
      for (const { element, polygon, sign } of shades) {
        if (!element) continue;
        const strip = element.firstElementChild as HTMLElement | null;
        if (!geometry || !polygon || !strip) {
          element.style.clipPath = EMPTY_CLIP;
          continue;
        }
        element.style.clipPath = polygonCss(polygon, spineX);
        const angle = Math.atan2(sign * geometry.normal.y, sign * geometry.normal.x);
        const reach = Math.hypot(W, H);
        strip.style.left = `${geometry.origin.x + spineX}px`;
        strip.style.top = `${geometry.origin.y - reach}px`;
        strip.style.height = `${2 * reach}px`;
        strip.style.transform = `rotate(${angle}rad)`;
        element.style.opacity = String(Math.min(1, 2.4 * Math.sin(Math.PI * geometry.progress)));
      }
    },
    [W, H, twoPage, spineX],
  );

  const clearFrame = useCallback(() => {
    const elements = [...slotRefs.current.values(), paperRef.current];
    for (const element of elements) {
      if (!element) continue;
      element.style.clipPath = "";
      element.style.transform = "";
    }
    for (const element of [revealShadeRef.current, flapShadeRef.current]) {
      if (element) element.style.clipPath = EMPTY_CLIP;
    }
  }, []);

  // ——— Burchak animatsiyasi (rAF; React render'siz) ———
  const runner = useRef<{ finish: () => void; cancel: () => void } | null>(null);
  const animateCorner = useCallback(
    (current: Flip, from: Point, to: Point, duration: number, lift: number, done: () => void) => {
      runner.current?.cancel();
      let start = 0;
      let frame = 0;
      let over = false;
      const finish = () => {
        if (over) return;
        over = true;
        window.cancelAnimationFrame(frame);
        runner.current = null;
        applyFrame(current, to);
        done();
      };
      const step = (now: number) => {
        if (!start) start = now;
        const progress = (now - start) / duration;
        if (progress >= 1) return finish();
        applyFrame(current, cornerPath(from, to, lift, progress));
        frame = window.requestAnimationFrame(step);
      };
      runner.current = {
        finish,
        cancel: () => {
          over = true;
          window.cancelAnimationFrame(frame);
          runner.current = null;
        },
      };
      applyFrame(current, from);
      frame = window.requestAnimationFrame(step);
    },
    [applyFrame],
  );
  useEffect(() => () => runner.current?.cancel(), []);

  /** Varaq to'liq ag'darilgan / joyida turgan burchak nuqtalari. */
  const flatPoint = (corner: Corner) => cornerPoint(W, H, corner);
  const turnedPoint = (corner: Corner) => ({ x: -W, y: flatPoint(corner).y });

  const flippedTo = useRef<number | null>(null);
  const commit = useCallback(
    (current: Flip, landed: "to" | "from", notify: boolean) => {
      const spread = landed === "to" ? current.to : current.from;
      flippedTo.current = spread.start;
      setShown({ ...spread, twoPage });
      setFlip(null);
      if (notify && landed === "to") onGo(spread.start);
    },
    [twoPage, onGo],
  );

  // ——— Tashqaridan bet o'zgardi (tugma, klaviatura, raqam, mundarija) → ag'darish ———
  // Holat render paytida moslanadi (effekt orqali emas — ortiqcha render yo'q).
  const [cornerHint, setCornerHint] = useState<Corner | null>(null);
  const canAnimate =
    !simple &&
    W > 0 &&
    typeof window !== "undefined" &&
    typeof window.requestAnimationFrame === "function";
  if (!flip && target.start !== rest.start) {
    const direction = flipDirection(rest.start, target.start);
    if (!canAnimate || direction === 0) {
      setShown({ ...target, twoPage });
    } else {
      setFlip({
        from: rest,
        to: target,
        reverse: direction < 0,
        corner: cornerHint ?? "bottom",
        mode: "anim",
        jump: !isNeighbourFlip(rest.start, target.start, total, twoPage),
      });
    }
    if (cornerHint) setCornerHint(null);
  }

  // Animatsiya paytida yangi bet so'raldi: joriysi darhol tugaydi, keyin yangisiga o'tiladi.
  useLayoutEffect(() => {
    if (flip?.mode === "anim" && flip.to.start !== target.start) runner.current?.finish();
  }, [flip, target.start]);

  // Ag'darishsiz almashgan yoyma (harakat kamaytirilgan / sust qurilma) — oddiy crossfade.
  const bookContentRef = useRef<HTMLDivElement>(null);
  const shownStart = useRef(rest.start);
  useLayoutEffect(() => {
    if (shownStart.current === rest.start) return;
    shownStart.current = rest.start;
    if (flippedTo.current === rest.start) return;
    bookContentRef.current?.animate?.([{ opacity: 0.35 }, { opacity: 1 }], {
      duration: 200,
      easing: "ease-out",
    });
  }, [rest.start]);

  // Yangi ag'darish: ag'darish paytida matn belgilanmaydi; avtomatik bo'lsa animatsiya boshlanadi.
  const dragPoint = useRef<Point | null>(null);
  useLayoutEffect(() => {
    if (!flip) {
      clearFrame();
      return;
    }
    window.getSelection?.()?.removeAllRanges();
    if (flip.mode === "drag") {
      if (dragPoint.current) applyFrame(flip, dragPoint.current);
      return;
    }
    const from = flip.reverse ? turnedPoint(flip.corner) : flatPoint(flip.corner);
    const to = flip.reverse ? flatPoint(flip.corner) : turnedPoint(flip.corner);
    const lift = (flip.corner === "bottom" ? -1 : 1) * H * 0.12;
    if (flip.jump) {
      const reveal = flipPages(flip).reveal;
      const element = reveal !== null ? slotRefs.current.get(reveal) : undefined;
      element?.animate?.([{ opacity: 0.3 }, { opacity: 1 }], {
        duration: JUMP_MS,
        easing: "ease-out",
      });
    }
    animateCorner(flip, from, to, flip.jump ? JUMP_MS : FLIP_MS, lift, () =>
      commit(flip, "to", false),
    );
    // Faqat yangi ag'darish boshlanganda (`flip` obyekti faqat `setFlip` da almashadi).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flip]);

  // ——— Ko'rsatiladigan betlar: joriy yoyma ±2 (+ ag'darish betlari) ———
  const mounted = useMemo(() => {
    const pages = new Set<number>();
    const visible = spreadPageNumbers(rest);
    const from = Math.max(1, Math.min(...visible, rest.start) - RENDER_RADIUS);
    const to = Math.min(total, Math.max(...visible, rest.start) + RENDER_RADIUS);
    for (let number = from; number <= to; number += 1) pages.add(number);
    if (flip) for (const number of spreadPageNumbers(flip.to)) pages.add(number);
    return [...pages].sort((a, b) => a - b);
  }, [rest, flip, total]);

  // ——— Sudrash, bosish, swipe, pan ———
  const gesture = useRef<{
    id: number;
    kind: "pending" | "drag" | "pan" | "swipe";
    startX: number;
    startY: number;
    at: number;
    pan?: Point;
    side?: 1 | -1;
    corner?: Corner;
    last?: { x: number; at: number };
    speed?: number;
  } | null>(null);
  const pointers = useRef(new Set<number>());
  const lastTap = useRef<TapPoint | null>(null);

  const toLocal = (clientX: number, clientY: number): Point | null => {
    const box = bookRef.current?.getBoundingClientRect();
    const scale = view.scale.get();
    if (!box || !box.width || !scale) return null;
    return { x: (clientX - box.left) / scale, y: (clientY - box.top) / scale };
  };

  /** Chekka zona (varaq burchagi/qirrasi): `1` — oldinga, `-1` — orqaga. */
  const edgeZone = (local: Point | null): { side: 1 | -1; corner: Corner } | null => {
    if (!local || !W || local.y < 0 || local.y > H) return null;
    const zone = Math.max(44, W * 0.16);
    const corner: Corner = local.y < H / 2 ? "top" : "bottom";
    const width = bookSize.width;
    if (nextStart !== null && rest.right !== null && local.x > width - zone && local.x <= width) {
      return { side: 1, corner };
    }
    const hasLeft = twoPage ? rest.left !== null : true;
    if (prevStart !== null && hasLeft && local.x >= 0 && local.x < zone)
      return { side: -1, corner };
    return null;
  };

  const beginDrag = (side: 1 | -1, corner: Corner, local: Point) => {
    const neighbour = side > 0 ? nextStart : prevStart;
    if (neighbour === null) return false;
    dragPoint.current = clampCorner({ x: local.x - spineX, y: local.y }, W, H, corner);
    setFlip({
      from: rest,
      to: bookSpread(neighbour, total, twoPage),
      reverse: side < 0,
      corner,
      mode: "drag",
      jump: false,
    });
    return true;
  };

  const cancelGesture = () => {
    const current = gesture.current;
    gesture.current = null;
    if (current?.kind === "drag" && flipRef.current?.mode === "drag") setFlip(null);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    pointers.current.add(event.pointerId);
    if (pointers.current.size > 1 || view.isLive()) {
      cancelGesture();
      return;
    }
    if ((event.target as Element).closest("button, a, input")) return;
    const base = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      at: event.timeStamp,
    };
    if (view.panMode) {
      event.preventDefault();
      capture(event);
      event.currentTarget.style.cursor = "grabbing";
      gesture.current = { ...base, kind: "pan", pan: { x: view.x.get(), y: view.y.get() } };
      return;
    }
    if (flipRef.current) return;
    const zone = edgeZone(toLocal(event.clientX, event.clientY));
    if (zone) {
      // Chekkadan boshlangan sudrash — varaq; matn belgilanmasin.
      event.preventDefault();
      capture(event);
      gesture.current = { ...base, kind: "pending", side: zone.side, corner: zone.corner };
      return;
    }
    gesture.current = { ...base, kind: "swipe" };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    if (current.kind === "pan" && current.pan) {
      view.panTo({ x: current.pan.x + dx, y: current.pan.y + dy });
      return;
    }
    if (current.kind === "pending" && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      const local = toLocal(event.clientX, event.clientY);
      if (!local || !current.side || !current.corner) return;
      if (!beginDrag(current.side, current.corner, local)) {
        gesture.current = null;
        return;
      }
      current.kind = "drag";
    }
    if (current.kind === "drag" && current.corner) {
      const local = toLocal(event.clientX, event.clientY);
      const active = flipRef.current;
      if (!local) return;
      const point = clampCorner({ x: local.x - spineX, y: local.y }, W, H, current.corner);
      if (current.last) {
        const elapsed = Math.max(1, event.timeStamp - current.last.at);
        current.speed = (local.x - current.last.x) / elapsed;
      }
      current.last = { x: local.x, at: event.timeStamp };
      dragPoint.current = point;
      if (active?.mode === "drag") applyFrame(active, point);
    }
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    gesture.current = null;
    event.currentTarget.style.cursor = "";
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    if (current.kind === "pan") return;

    if (current.kind === "drag") {
      const active = flipRef.current;
      const point = dragPoint.current;
      if (!active || active.mode !== "drag" || !point || !current.corner) return;
      const speed = current.speed ?? 0;
      // Oldinga: burchak umurtqadan o'tsa yoki chapga silkitilsa; orqaga — aksincha.
      const complete = active.reverse
        ? point.x > 0 || speed > FLICK_SPEED
        : point.x < 0 || speed < -FLICK_SPEED;
      const end =
        complete !== active.reverse ? turnedPoint(current.corner) : flatPoint(current.corner);
      animateCorner(active, point, end, RELEASE_MS, 0, () =>
        commit(active, complete ? "to" : "from", complete),
      );
      return;
    }

    if (current.kind === "pending") {
      // Chekkani bosish: shu burchakdan ag'dariladi.
      setCornerHint(current.corner ?? null);
      const neighbour = current.side === 1 ? nextStart : prevStart;
      if (neighbour !== null) onGo(neighbour);
      return;
    }

    // Barmoq bilan swipe yoki ikki marta teginish (zoom: «Moslash» ↔ 200%).
    if (event.pointerType === "mouse") return;
    if (Math.hypot(dx, dy) < 10) {
      const tap = { x: event.clientX, y: event.clientY, at: event.timeStamp };
      if (isDoubleTap(lastTap.current, tap)) {
        lastTap.current = null;
        view.toggleAt(tap);
      } else {
        lastTap.current = tap;
      }
      return;
    }
    if (flipRef.current) return;
    const direction = swipeDirection(dx, dy, event.timeStamp - current.at);
    if (direction === "next" && nextStart !== null) onGo(nextStart);
    if (direction === "prev" && prevStart !== null) onGo(prevStart);
  };

  const onPointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    event.currentTarget.style.cursor = "";
    cancelGesture();
  };

  const onDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest("button, a, input")) return;
    // So'zni ikki marta bosib belgilash — zoom emas; chekka — varaqlash.
    if (window.getSelection?.()?.isCollapsed === false) return;
    if (!view.panMode && edgeZone(toLocal(event.clientX, event.clientY))) return;
    view.toggleAt({ x: event.clientX, y: event.clientY });
  };

  const setStageRef = useCallback(
    (element: HTMLDivElement | null) => {
      setStage(element);
      areaRef?.(element);
    },
    [areaRef],
  );

  // ——— Ko'rinish ———
  const range = spreadRange(rest);
  const announce =
    range.from === range.to
      ? t("bookPage", { page: range.from })
      : t("bookPages", { from: range.from, to: range.to });
  const depths = stackDepths(rest.start, total);
  const sideStyle = (side: "left" | "right"): CSSProperties => ({
    left: side === "left" ? spineX - W : spineX,
    width: W,
    height: H,
  });
  const showSpine = twoPage && rest.left !== null && rest.right !== null;

  return (
    <div
      ref={setStageRef}
      data-testid="pdf-page-area"
      data-mode="b"
      data-flipping={flip ? "true" : undefined}
      className={cn(
        "book-desk absolute inset-x-0 top-0 touch-none overflow-hidden overscroll-none select-none",
        view.panMode && "cursor-grab",
      )}
      style={{ bottom: NAV_RESERVE, right: reserveRight, transition: "right 300ms ease" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onDoubleClick={onDoubleClick}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <m.div
          ref={bookRef}
          role="group"
          aria-label={t("book")}
          aria-roledescription={t("book")}
          data-testid="pdf-zoom-content"
          data-zoom={zoom}
          data-two-page={twoPage || undefined}
          className="relative shrink-0"
          style={{ width: bookSize.width, height: H, x: view.x, y: view.y, scale: view.scale }}
        >
          <div ref={bookContentRef} className="absolute inset-0">
            {/* Kitob asosi: varaqlar to'plami (qalinlik) va yer soyasi; bo'sh tomonda yo'q. */}
            {(twoPage ? (["left", "right"] as const) : (["right"] as const)).map((side) =>
              (side === "left" ? rest.left : rest.right) !== null ? (
                <div
                  key={side}
                  aria-hidden
                  className="book-base absolute top-0"
                  style={{
                    ...sideStyle(side),
                    ["--book-stack" as string]:
                      stackShadow(
                        side === "left" ? depths.left : depths.right,
                        side === "left" ? -1 : 1,
                      ) || "0 0 transparent",
                  }}
                />
              ) : null,
            )}

            {mounted.map((number) => {
              const role = roleOf(number, rest, flip);
              const side = LEFT_ROLES.includes(role) ? "left" : "right";
              const visible = role !== "hidden";
              return (
                <div
                  key={`p${number}`}
                  ref={(element) => {
                    if (element) slotRefs.current.set(number, element);
                    else slotRefs.current.delete(number);
                  }}
                  aria-hidden={visible ? undefined : true}
                  data-book-role={role}
                  data-slot={visible ? "current" : "prefetch"}
                  className={cn("book-page absolute top-0", !visible && "pointer-events-none")}
                  style={{
                    ...sideStyle(side),
                    zIndex: Z_INDEX[role],
                    visibility: visible ? "visible" : "hidden",
                  }}
                >
                  {renderPage(number, {
                    current: number === page,
                    align: twoPage ? (side === "left" ? "end" : "start") : "center",
                    prefetch: !visible,
                    renderScale: view.renderScale,
                    pool,
                    priority: visible ? 0 : 1,
                  })}
                </div>
              );
            })}

            {/* Bitta bet rejimida varaqning orqa tomoni — toza qog'oz. */}
            {!twoPage && (
              <div
                ref={paperRef}
                aria-hidden
                className="book-page absolute top-0"
                style={{
                  ...sideStyle("left"),
                  zIndex: Z_INDEX.back,
                  visibility: flip ? "visible" : "hidden",
                  clipPath: EMPTY_CLIP,
                }}
              />
            )}

            {showSpine && (
              <div
                aria-hidden
                className="book-spine pointer-events-none absolute top-0"
                style={{ left: W - 32, width: 64, height: H, zIndex: 3 }}
              />
            )}

            {/* Harakatdagi soya (ochilayotgan bet ustida) va yorug'lik (buklangan varaqda). */}
            <div
              ref={revealShadeRef}
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ zIndex: 3, clipPath: EMPTY_CLIP }}
            >
              <div className="book-curl-shadow absolute origin-left" style={{ width: W * 0.3 }} />
            </div>
            <div
              ref={flapShadeRef}
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ zIndex: 5, clipPath: EMPTY_CLIP }}
            >
              <div className="book-curl-light absolute origin-left" style={{ width: W * 0.45 }} />
            </div>
          </div>
        </m.div>
      </div>

      <p className="sr-only" aria-live="polite" data-testid="book-announce">
        {announce}
      </p>

      <button
        type="button"
        aria-label={t("prev")}
        data-testid="pdf-edge-prev"
        disabled={prevStart === null}
        onClick={() => prevStart !== null && onGo(prevStart)}
        className="pdf-edge-button left-1 lg:left-3"
      >
        <ChevronLeft className="size-6" aria-hidden />
      </button>
      <button
        type="button"
        aria-label={t("next")}
        data-testid="pdf-edge-next"
        disabled={nextStart === null}
        onClick={() => nextStart !== null && onGo(nextStart)}
        className="pdf-edge-button right-1 lg:right-3"
      >
        <ChevronRight className="size-6" aria-hidden />
      </button>
    </div>
  );
}
