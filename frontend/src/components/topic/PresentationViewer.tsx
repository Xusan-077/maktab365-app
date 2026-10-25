"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize,
  Minimize,
  StickyNote,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui/Skeleton";
import { useFullscreen } from "@/hooks/useFullscreen";
import { Link, usePathname, useRouter } from "@/lib/i18n/navigation";
import { swipeDirection } from "@/lib/pdf/swipe";
import { topicQueries } from "@/lib/topic-materials/queries";
import { slideIndexParam, visibleSlides } from "@/lib/topic-materials/slides";
import { cn } from "@/lib/utils/cn";

export interface PresentationViewerProps {
  topicId: string;
  topicTitle: string;
  bookTitle: string;
  /** O'qish oynasi (mavzu beti): «orqaga» va Esc shu yerga qaytaradi. */
  backHref: string;
}

const isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA"].includes(target.tagName));
const isPressable = (target: EventTarget | null) =>
  target instanceof HTMLElement && ["BUTTON", "A"].includes(target.tagName);

const STAGE_BUTTON =
  "text-white hover:bg-white/10 inline-flex size-11 shrink-0 items-center justify-center rounded-ds-sm transition-colors disabled:pointer-events-none disabled:opacity-35";

/**
 * Mavzu taqdimoti: qorong'i fon, chapda slayd eskizlari (mobilda yashirin), markazda 16:9 slayd,
 * pastda progress segmentlari, oldingi/keyingi va "4 / 12", ustoz eslatmasi (bo'lsa, yashirish
 * mumkin). ← → Space (Shift+Space — orqaga), Home/End, F — butun ekran, Esc — o'qish oynasiga.
 * Joriy slayd URL'da (`?slayd=4`). Yashirin slaydlar ko'rsatilmaydi.
 */
export function PresentationViewer({
  topicId,
  topicTitle,
  bookTitle,
  backHref,
}: PresentationViewerProps) {
  const t = useTranslations("presentation");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const stageRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLOListElement>(null);
  const fullscreen = useFullscreen(stageRef);
  const presentation = useQuery(topicQueries.presentation(topicId));
  const slides = presentation.data ? visibleSlides(presentation.data.slides) : [];
  const count = slides.length;
  const urlIndex = slideIndexParam(searchParams.get("slayd"), count);
  // Tez bosishlarda URL kechikadi: so'ralgan slayd URL yetguncha ko'rsatiladi.
  const [pending, setPending] = useState<number | null>(null);
  if (pending !== null && pending === urlIndex) setPending(null);
  const index = pending ?? urlIndex;
  const slide = slides[index];
  const [noteOpen, setNoteOpen] = useState(true);

  const go = useCallback(
    (next: number) => {
      if (count === 0) return;
      const target = Math.min(count - 1, Math.max(0, next));
      setPending(target);
      router.replace(`${pathname}?slayd=${target + 1}`, { scroll: false });
    },
    [count, pathname, router],
  );

  // Joriy eskiz rail'da ko'rinib tursin.
  useEffect(() => {
    railRef.current
      ?.querySelector<HTMLElement>('[aria-current="true"]')
      ?.scrollIntoView?.({ block: "nearest" });
  }, [index]);

  const toggleFullscreen = fullscreen.toggle;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (isTypingTarget(event.target)) return;
      const space = event.key === " " && !isPressable(event.target);
      if (event.key === "ArrowRight" || (space && !event.shiftKey)) {
        event.preventDefault();
        go(index + 1);
      } else if (event.key === "ArrowLeft" || (space && event.shiftKey)) {
        event.preventDefault();
        go(index - 1);
      } else if (event.key === "Home") {
        event.preventDefault();
        go(0);
      } else if (event.key === "End") {
        event.preventDefault();
        go(count - 1);
      } else if (event.key.toLowerCase() === "f" && fullscreen.supported) {
        event.preventDefault();
        toggleFullscreen();
      } else if (event.key === "Escape" && !fullscreen.active) {
        // To'liq ekranda Esc'ni brauzer o'zi oladi (chiqadi); oddiy holatda — o'qish oynasiga.
        router.push(backHref);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    go,
    index,
    count,
    toggleFullscreen,
    fullscreen.supported,
    fullscreen.active,
    router,
    backHref,
  ]);

  const touch = useRef<{ x: number; y: number; at: number } | null>(null);
  const onPointerDown = (event: PointerEvent) => {
    touch.current = { x: event.clientX, y: event.clientY, at: event.timeStamp };
  };
  const onPointerUp = (event: PointerEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start || event.pointerType === "mouse") return;
    const direction = swipeDirection(
      event.clientX - start.x,
      event.clientY - start.y,
      event.timeStamp - start.at,
    );
    if (direction === "next") go(index + 1);
    if (direction === "prev") go(index - 1);
  };

  const body = presentation.isPending ? (
    <div role="status" aria-label={t("loading")} className="flex flex-1 items-center p-4">
      <Skeleton className="mx-auto aspect-video w-full max-w-5xl bg-white/10" />
    </div>
  ) : presentation.error || count === 0 ? (
    <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
      <p className="text-ds-stage-muted text-center">
        {presentation.error ? t("loadError") : t("empty")}
      </p>
      <Link
        href={backHref}
        className="bg-ds-accent text-ds-on-accent rounded-ds-sm inline-flex h-11 items-center px-4 text-sm font-bold"
      >
        {t("back")}
      </Link>
    </div>
  ) : (
    <div className="flex min-h-0 flex-1">
      <nav
        aria-label={t("thumbs")}
        className="border-ds-stage-line hidden w-48 shrink-0 overflow-y-auto border-r p-3 md:block lg:w-56"
      >
        <ol ref={railRef} className="flex flex-col gap-2">
          {slides.map((item, itemIndex) => (
            <li key={item.id}>
              <button
                type="button"
                aria-current={itemIndex === index}
                aria-label={t("goTo", { n: itemIndex + 1 })}
                data-testid="presentation-thumb"
                onClick={() => go(itemIndex)}
                className={cn(
                  "group rounded-ds-sm flex w-full items-start gap-2 p-1.5 text-left transition-colors",
                  itemIndex === index ? "bg-white/10" : "hover:bg-white/5",
                )}
              >
                <span className="text-ds-stage-muted w-5 shrink-0 pt-1 text-right text-xs font-semibold tabular-nums">
                  {itemIndex + 1}
                </span>
                <span
                  className={cn(
                    "relative aspect-video min-w-0 flex-1 overflow-hidden rounded-lg border-2",
                    itemIndex === index ? "border-ds-accent" : "border-transparent",
                  )}
                >
                  <Image
                    src={item.thumb_url}
                    alt=""
                    fill
                    sizes="200px"
                    unoptimized
                    className="object-cover"
                  />
                </span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col gap-3 p-3 sm:p-5">
        <div
          className="flex min-h-0 flex-1 touch-pan-y items-center justify-center"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (touch.current = null)}
        >
          {slide && (
            <figure className="rounded-ds relative aspect-video max-h-full w-full max-w-[min(100%,calc((100dvh-15rem)*16/9))] overflow-hidden bg-white shadow-xl">
              <Image
                key={slide.id}
                src={slide.image_url}
                alt={slide.alt || t("slideAlt", { n: index + 1 })}
                fill
                priority
                sizes="(min-width: 1024px) 70vw, 100vw"
                unoptimized
                className="object-contain"
                data-testid="presentation-slide"
              />
            </figure>
          )}
        </div>

        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
          <div aria-hidden className="flex gap-1" data-testid="presentation-segments">
            {slides.map((item, itemIndex) => (
              <span
                key={item.id}
                className={cn(
                  "h-1 flex-1 rounded-full",
                  itemIndex <= index ? "bg-ds-accent" : "bg-white/15",
                )}
              />
            ))}
          </div>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              aria-label={t("prev")}
              data-testid="presentation-prev"
              disabled={index === 0}
              onClick={() => go(index - 1)}
              className={STAGE_BUTTON}
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <p
              aria-live="polite"
              data-testid="presentation-position"
              className="min-w-16 text-center text-sm font-bold text-white tabular-nums"
            >
              <span className="sr-only">{t("positionLabel")} </span>
              {t("position", { n: index + 1, total: count })}
            </p>
            <button
              type="button"
              aria-label={t("next")}
              data-testid="presentation-next"
              disabled={index >= count - 1}
              onClick={() => go(index + 1)}
              className={cn(STAGE_BUTTON, "bg-ds-accent hover:bg-ds-accent-ink")}
            >
              <ChevronRight className="size-5" aria-hidden />
            </button>
          </div>

          {slide?.note && (
            <section
              aria-label={t("note")}
              data-testid="presentation-note"
              className="border-ds-stage-line bg-ds-stage-panel rounded-ds border p-3 text-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-ds-warn-border flex items-center gap-2 text-xs font-extrabold tracking-wider uppercase">
                  <StickyNote className="size-4" aria-hidden />
                  {t("note")}
                </p>
                <button
                  type="button"
                  aria-expanded={noteOpen}
                  aria-controls={`note-${slide.id}`}
                  onClick={() => setNoteOpen((value) => !value)}
                  className="text-ds-stage-muted rounded-ds-sm min-h-11 px-3 text-xs font-semibold hover:bg-white/10 hover:text-white"
                >
                  {noteOpen ? t("hideNote") : t("showNote")}
                </button>
              </div>
              <p
                id={`note-${slide.id}`}
                hidden={!noteOpen}
                className="mt-1 leading-relaxed whitespace-pre-line text-white/90"
              >
                {slide.note}
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div
      ref={stageRef}
      data-testid="presentation-viewer"
      className="bg-ds-stage font-ui flex h-dvh flex-col text-white"
    >
      <header className="border-ds-stage-line flex h-14 shrink-0 items-center gap-2 border-b px-2 sm:px-4">
        <Link href={backHref} aria-label={t("back")} className={STAGE_BUTTON}>
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[0.9375rem] font-bold">{topicTitle}</h1>
          <p className="text-ds-stage-muted truncate text-xs">
            {t("subtitle", { book: bookTitle })}
          </p>
        </div>
        {presentation.data?.pdf_url && (
          <a
            href={presentation.data.pdf_url}
            download
            data-testid="presentation-pdf"
            className="rounded-ds-sm inline-flex h-11 shrink-0 items-center gap-2 px-3 text-sm font-semibold hover:bg-white/10"
          >
            <Download className="size-4" aria-hidden />
            <span className="max-sm:sr-only">{t("downloadPdf")}</span>
          </a>
        )}
        {fullscreen.supported && (
          <button
            type="button"
            aria-label={t(fullscreen.active ? "exitFullscreen" : "fullscreen")}
            aria-pressed={fullscreen.active}
            aria-keyshortcuts="F"
            onClick={toggleFullscreen}
            className={STAGE_BUTTON}
          >
            {fullscreen.active ? (
              <Minimize className="size-5" aria-hidden />
            ) : (
              <Maximize className="size-5" aria-hidden />
            )}
          </button>
        )}
      </header>
      {body}
    </div>
  );
}
