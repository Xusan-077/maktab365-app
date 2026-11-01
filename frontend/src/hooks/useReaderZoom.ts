"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import {
  clampZoomSmooth,
  commitZoom,
  doubleTapZoom,
  nextZoomStep,
  nudgeZoom,
  wheelZoomSmooth,
  ZOOM_BUTTON_ANIMATION_MS,
  ZOOM_COMMIT_DEBOUNCE_MS,
} from "@/lib/pdf/zoom";
import { useReaderPrefsStore } from "@/stores/reader-prefs.store";

interface Point {
  x: number;
  y: number;
}

/**
 * Zoom'dan keyin fokus nuqtasini joyida qoldirish uchun (o'lchovlar zoom holatga yozilishidan oldin,
 * kontent hali CSS `scale` da — ya'ni foydalanuvchi ko'rib turgan joy):
 * - `fractionX` — fokus kontent enining qaysi qismida (0..1), `clientX` — ekrandagi `x`;
 * - `slot` — fokus ostidagi bet va undagi nisbiy o'rni (0..1), `clientY` — ekrandagi `y`. Butun
 *   ro'yxatni proporsional deb olish xato edi: oraliqlar va yaxlitlash uzoq betlarda yuzlab px
 *   xato berib, ekranga boshqa bet chiqarardi.
 */
interface PendingAnchor {
  fractionX: number;
  clientX: number;
  slot: { page: number; fraction: number; clientY: number } | null;
}

/** Gesture (pinch, g'ildirak, Safari gesture, tugma animatsiyasi) davomidagi oldindan ko'rish. */
interface Preview {
  /** Gesture boshidagi (holatdagi) zoom. */
  base: number;
  /** Hozirgi (yaxlitlanmagan) zoom: faqat shu ref'da, React holatida emas. */
  scale: number;
  point: Point;
  frame: number;
}

/** Safari'ning trackpad / iOS pinch hodisasi (standart `lib.dom` da yo'q). */
interface GestureLike extends UIEvent {
  scale: number;
  clientX: number;
  clientY: number;
}

/** `y` (ekran) dagi yoki undan oldingi oxirgi bet uyasi (`data-page-slot`, tepadan pastga tartibda). */
function slotAt(content: HTMLElement, y: number) {
  const slots = content.querySelectorAll<HTMLElement>("[data-page-slot]");
  if (slots.length === 0) return null;
  let low = 0;
  let high = slots.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (slots[mid].getBoundingClientRect().top <= y) low = mid;
    else high = mid - 1;
  }
  const slot = slots[low];
  const rect = slot.getBoundingClientRect();
  const page = Number(slot.dataset.pageSlot);
  if (!Number.isFinite(page) || rect.height <= 0) return null;
  return { page, fraction: Math.min(1, Math.max(0, (y - rect.top) / rect.height)) };
}

const distance = (touches: TouchList) =>
  Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
const center = (touches: TouchList): Point => ({
  x: (touches[0].clientX + touches[1].clientX) / 2,
  y: (touches[0].clientY + touches[1].clientY) / 2,
});
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;

/**
 * Uzluksiz rejim zoom'i (50%–400%): tugma/klaviatura, ikki marta bosish, ikki barmoq (pinch),
 * Ctrl/⌘+g'ildirak (Chrome/Edge/Firefox trackpad pinch ham) va Safari `gesture*`.
 *
 * Silliqlik: gesture davomida **React holati o'zgarmaydi va layout o'zgarmaydi** — joriy qiymat
 * `preview` ref'ida, kontentga faqat CSS `transform: scale()` (`will-change`, origin — fokusda)
 * yoziladi, bir kadrda bir marta (rAF). Gesture tugagach (g'ildirak — 150 ms tinchlikdan keyin)
 * qiymat bir marta holatga yoziladi: betlar yangi eniga o'tadi, transform shu kadrning o'zida
 * olinadi va fokus nuqtasi joyiga qaytariladi (scroll); eski tasvir cho'zilib turadi, aniqrog'i
 * ko'rinib turgan betlar uchun chiziladi (`PdfPageCanvas`). Tugmalar ham shu yo'ldan — 180 ms
 * animatsiya, keyin bitta holat yozuvi.
 *
 * Kattalashganda surish brauzerning o'zida (`overflow-x-auto` + `touch-pan-x touch-pan-y`); pinch'ni
 * brauzer bajarmaydi (`touch-action` da `pinch-zoom` yo'q), ikki barmoqli `touchmove` shu yerda
 * `preventDefault` qilinadi.
 */
export function useReaderZoom({
  stageRef,
  fullscreen,
}: {
  stageRef: RefObject<HTMLElement | null>;
  fullscreen: boolean;
}) {
  // Zoom — umumiy holat (`reader-prefs.store`): kitob rejimi, Aa menyusi va zoom guruhi bilan bitta.
  const zoom = useReaderPrefsStore((state) => state.zoom);
  const setZoom = useReaderPrefsStore((state) => state.setZoom);
  const [area, setArea] = useState<HTMLElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  useLayoutEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  const pending = useRef<PendingAnchor | null>(null);
  const preview = useRef<Preview | null>(null);
  const animation = useRef(0);
  /** Pinch bo'lgan teginish tap/swipe hisoblanmasin (PdfReader pointer handler'lari uchun). */
  const pinched = useRef(false);

  const clearTransform = useCallback(() => {
    const content = contentRef.current;
    if (!content) return;
    content.style.transform = "";
    content.style.transformOrigin = "";
    content.style.willChange = "";
  }, []);

  /** Holatga yozish (gesture oxirida bir marta): fokus o'lchanadi, keyin `setZoom`. */
  const applyZoom = useCallback(
    (next: number, point?: Point): boolean => {
      const previous = zoomRef.current;
      const target = commitZoom(next);
      if (target === previous) return false;
      const scroller = scrollerRef.current;
      const content = contentRef.current;
      if (scroller && content) {
        const box = scroller.getBoundingClientRect();
        const rect = content.getBoundingClientRect();
        const x = point?.x ?? box.left + box.width / 2;
        const y = point?.y ?? Math.min(window.innerHeight / 2, rect.bottom);
        const slot = slotAt(content, y);
        pending.current = {
          fractionX: rect.width > 0 ? (x - rect.left) / rect.width : 0.5,
          clientX: x,
          slot: slot && { ...slot, clientY: y },
        };
      }
      zoomRef.current = target;
      setZoom(target);
      return true;
    },
    [setZoom],
  );

  // Yangi zoom layout'da: transform shu kadrning o'zida olinadi (paint'dan oldin) va fokus nuqtasi
  // ekrandagi joyiga qaytariladi — ko'rinish sakramaydi.
  useLayoutEffect(() => {
    if (!preview.current) clearTransform();
    const anchor = pending.current;
    if (!anchor) return;
    pending.current = null;
    const scroller = scrollerRef.current;
    const content = contentRef.current;
    if (scroller && content) {
      const rect = content.getBoundingClientRect();
      const dx = rect.left + anchor.fractionX * rect.width - anchor.clientX;
      if (Math.abs(dx) >= 0.5) scroller.scrollLeft += dx;
    }
    const root = fullscreen ? stageRef.current : window;
    const slot = anchor.slot
      ? content?.querySelector<HTMLElement>(`[data-page-slot="${anchor.slot.page}"]`)
      : null;
    if (!anchor.slot || !slot) return;
    const rect = slot.getBoundingClientRect();
    const dy = rect.top + anchor.slot.fraction * rect.height - anchor.slot.clientY;
    if (Math.abs(dy) >= 0.5) root?.scrollBy?.({ top: dy, behavior: "instant" });
  }, [zoom, fullscreen, stageRef, clearTransform]);

  const writeTransform = useCallback(() => {
    const current = preview.current;
    const content = contentRef.current;
    if (current && content) content.style.transform = `scale(${current.scale / current.base})`;
  }, []);

  /** Gesture boshlandi: origin fokusda, `will-change` (holat o'zgarmaydi). */
  const beginPreview = useCallback((point: Point): Preview => {
    window.cancelAnimationFrame(animation.current);
    animation.current = 0;
    if (preview.current) return preview.current;
    const content = contentRef.current;
    const scroller = scrollerRef.current;
    if (content) {
      const rect = content.getBoundingClientRect();
      // Bet konteynerga sig'sa (`mx-auto` — markazda) yangi layout markazdan kengayadi: x origin ham
      // markazda, aks holda qo'yib yuborganda gorizontal sakrash bo'lardi.
      const fits = !scroller || rect.width <= scroller.clientWidth + 1;
      const originX = fits ? rect.width / 2 : point.x - rect.left;
      content.style.transformOrigin = `${originX}px ${point.y - rect.top}px`;
      content.style.willChange = "transform";
    }
    preview.current = { base: zoomRef.current, scale: zoomRef.current, point, frame: 0 };
    return preview.current;
  }, []);

  /** Gesture davomida: faqat ref + bir kadrda bir marta transform. */
  const updatePreview = useCallback(
    (scale: number) => {
      const current = preview.current;
      if (!current) return;
      current.scale = clampZoomSmooth(scale);
      if (current.frame) return;
      current.frame = window.requestAnimationFrame(() => {
        current.frame = 0;
        writeTransform();
      });
    },
    [writeTransform],
  );

  /** Gesture tugadi: bitta holat yozuvi (o'zgarmagan bo'lsa — transform olinadi). */
  const endPreview = useCallback(() => {
    const current = preview.current;
    if (!current) return;
    window.cancelAnimationFrame(current.frame);
    writeTransform();
    preview.current = null;
    if (!applyZoom(current.scale, current.point)) clearTransform();
  }, [applyZoom, clearTransform, writeTransform]);

  const viewportCenter = useCallback((): Point => {
    const box = (area ?? scrollerRef.current)?.getBoundingClientRect();
    return { x: box ? box.left + box.width / 2 : window.innerWidth / 2, y: window.innerHeight / 2 };
  }, [area]);

  /**
   * Tugma/klaviatura/ikki marta bosish: 180 ms silliq o'tish (transform), keyin bitta holat yozuvi.
   * Kontent yo'q (kitob rejimi — `useBookZoom` o'zi animatsiya qiladi) yoki «kamroq harakat» — darhol.
   */
  const animateTo = useCallback(
    (target: number, point?: Point) => {
      const goal = commitZoom(target);
      if (!contentRef.current || reducedMotion()) {
        applyZoom(goal, point);
        return;
      }
      const current = beginPreview(point ?? viewportCenter());
      const from = current.scale;
      if (Math.abs(goal - from) < 1e-3) {
        endPreview();
        return;
      }
      const startedAt = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / ZOOM_BUTTON_ANIMATION_MS);
        current.scale = from + (goal - from) * easeOut(progress);
        writeTransform();
        if (progress < 1) {
          animation.current = window.requestAnimationFrame(tick);
        } else {
          animation.current = 0;
          current.scale = goal;
          endPreview();
        }
      };
      animation.current = window.requestAnimationFrame(tick);
    },
    [applyZoom, beginPreview, endPreview, viewportCenter, writeTransform],
  );

  useEffect(() => {
    if (!area) return;
    let start: { distance: number; zoom: number } | null = null;
    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      pinched.current = true;
      const current = beginPreview(center(event.touches));
      start = { distance: distance(event.touches), zoom: current.scale };
    };
    const onMove = (event: TouchEvent) => {
      if (!start || event.touches.length !== 2) return;
      event.preventDefault();
      // Jonli qiymat yaxlitlanmaydi (pinch «zinapoya» bo'lmasin); commit — `applyZoom`.
      const ratio = start.distance > 0 ? distance(event.touches) / start.distance : 1;
      updatePreview(start.zoom * ratio);
    };
    const onEnd = (event: TouchEvent) => {
      if (!start || event.touches.length >= 2) return;
      start = null;
      endPreview();
    };
    // Ctrl/⌘+g'ildirak (Chrome/Edge/Firefox trackpad pinch ham — `ctrlKey: true`): oynada
    // `passive: false` — kursor sarlavha/panel ustida bo'lsa ham brauzer zoom'i ishlamaydi; maydondan
    // tashqarida fokus — ekran markazi. Qadam `deltaY` ga mutanosib (`wheelZoomSmooth`).
    let timer = 0;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const inside = event.target instanceof Node && area.contains(event.target);
      const current = beginPreview(
        inside ? { x: event.clientX, y: event.clientY } : viewportCenter(),
      );
      updatePreview(wheelZoomSmooth(current.scale, event.deltaY, event.deltaMode));
      window.clearTimeout(timer);
      timer = window.setTimeout(endPreview, ZOOM_COMMIT_DEBOUNCE_MS);
    };
    // Safari (macOS trackpad pinch) `ctrlKey` li wheel emas, `gesture*` yuboradi; bekor qilinmasa
    // brauzer butun sahifani kattalashtiradi. iOS'da pinch touch orqali (`start`) — bu yerda faqat
    // brauzer zoom'i to'xtatiladi.
    let gesture: { zoom: number } | null = null;
    const onGestureStart = (event: Event) => {
      event.preventDefault();
      if (start) return;
      const { clientX, clientY } = event as GestureLike;
      const inside = event.target instanceof Node && area.contains(event.target);
      pinched.current = true;
      const current = beginPreview(
        inside && Number.isFinite(clientX) ? { x: clientX, y: clientY } : viewportCenter(),
      );
      gesture = { zoom: current.scale };
    };
    const onGestureChange = (event: Event) => {
      event.preventDefault();
      if (!gesture || start) return;
      updatePreview(gesture.zoom * ((event as GestureLike).scale || 1));
    };
    const onGestureEnd = (event: Event) => {
      event.preventDefault();
      const current = gesture;
      gesture = null;
      if (current && !start) endPreview();
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("gesturestart", onGestureStart, { passive: false });
    window.addEventListener("gesturechange", onGestureChange, { passive: false });
    window.addEventListener("gestureend", onGestureEnd, { passive: false });
    area.addEventListener("touchstart", onStart, { passive: true });
    area.addEventListener("touchmove", onMove, { passive: false });
    area.addEventListener("touchend", onEnd);
    area.addEventListener("touchcancel", onEnd);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("gesturestart", onGestureStart);
      window.removeEventListener("gesturechange", onGestureChange);
      window.removeEventListener("gestureend", onGestureEnd);
      area.removeEventListener("touchstart", onStart);
      area.removeEventListener("touchmove", onMove);
      area.removeEventListener("touchend", onEnd);
      area.removeEventListener("touchcancel", onEnd);
    };
  }, [area, beginPreview, updatePreview, endPreview, viewportCenter]);

  // Unmount: animatsiya/kadr to'xtaydi.
  useEffect(
    () => () => {
      window.cancelAnimationFrame(animation.current);
      if (preview.current) window.cancelAnimationFrame(preview.current.frame);
    },
    [],
  );

  /** Gesture yoki tugma animatsiyasi davom etmoqda (joriy bet qayta hisoblanmasin). */
  const isZooming = useCallback(() => preview.current !== null, []);
  /** Joriy (gesture paytida — oldindan ko'rishdagi) zoom: tugmalar ketma-ket bosilsa shundan. */
  const currentZoom = useCallback(() => preview.current?.scale ?? zoomRef.current, []);

  /** Klaviatura / tugma `+`/`−`: 25% qadam, animatsiya bilan. */
  const nudge = useCallback(
    (direction: 1 | -1) => animateTo(nudgeZoom(currentZoom(), direction)),
    [animateTo, currentZoom],
  );
  /** Tugma / klaviatura: keyingi pog'ona (100 → 150 → 200 → 300 → 400 → 100%). */
  const stepZoom = useCallback(
    () => animateTo(nextZoomStep(currentZoom())),
    [animateTo, currentZoom],
  );
  /** Aniq qiymat (Aa menyusidagi −/+ va «100%»): chegaraga keltiriladi. */
  const setZoomLevel = useCallback((next: number) => animateTo(next), [animateTo]);
  /** Ikki marta bosish: 100% ↔ 200%, bosilgan joy ekranda qoladi. */
  const zoomAtTap = useCallback(
    (point: Point) => animateTo(doubleTapZoom(zoomRef.current), point),
    [animateTo],
  );
  /** Teginish boshlandi (asosiy barmoq): oldingi pinch belgisi tozalanadi. */
  const beginTouch = useCallback(() => {
    pinched.current = false;
  }, []);
  /** Shu teginishda pinch bo'ldimi (bo'lsa — tap ham, swipe ham emas). */
  const wasPinch = useCallback(() => pinched.current, []);

  return {
    zoom,
    isZooming,
    stepZoom,
    nudge,
    setZoomLevel,
    zoomAtTap,
    beginTouch,
    wasPinch,
    /** Teginishlar o'qiladigan sahifa maydoni (callback ref: element keyin paydo bo'lsa ham ulanadi). */
    areaRef: setArea,
    scrollerRef,
    contentRef,
  };
}
