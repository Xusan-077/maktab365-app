"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { useProgressRecorder } from "@/hooks/useProgressRecorder";
import { useTopicProgress } from "@/hooks/useProgress";
import { READ_COMPLETED_SCROLL } from "@/lib/progress/status";
import { useReadingStore, type ReadingPosition } from "@/stores/reading.store";

const BLOCK_SELECTOR = "[data-block-id]";
/** Shundan kam aylantirilgan joyni "davom ettirish" uchun eslamaymiz. */
const MIN_RESUME_SCROLL = 0.04;
/** Deyarli oxirigacha o'qilgan bo'lsa, taklif ko'rsatilmaydi. */
const MAX_RESUME_SCROLL = READ_COMPLETED_SCROLL;
const SAVE_DELAY_MS = 400;
/** Kabinetdagi "Davom ettirish" havolasi shu hash bilan oxirgi blokka olib keladi. */
const BLOCK_HASH = /^#block-(.+)$/;
/** Progressdagi `lastBlockId` bo'yicha taklifda aniq scroll yo'q: blokka o'tiladi. */
const NO_SCROLL = 0;

const findBlock = (blockId: string) =>
  document.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(blockId)}"]`);

const scrollBehavior = (): ScrollBehavior =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

function currentPosition(): Omit<ReadingPosition, "updatedAt"> {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const scroll = scrollable > 0 ? Math.min(1, window.scrollY / scrollable) : 0;
  // Oxirgi blok: yuqori chegarasi ekranning ~40% chizig'idan yuqorida bo'lgan eng so'nggi blok.
  const line = window.innerHeight * 0.4;
  let lastBlockId: string | undefined;
  for (const element of document.querySelectorAll<HTMLElement>(BLOCK_SELECTOR)) {
    if (element.getBoundingClientRect().top <= line) lastBlockId = element.dataset.blockId;
  }
  return { scroll, lastBlockId };
}

/**
 * O'qish hodisalarini yozadi (`topic_opened`, `reading_moved`, `topic_read`) va qaytib kelganda
 * bloklamaydigan "Davom ettirish" taklifini ko'rsatadi. Aniq scroll shu qurilmada (Zustand persist),
 * oxirgi blok esa progressda saqlanadi — shuning uchun boshqa qurilmada ham davom ettirish mumkin.
 */
export function ReadingTracker({ topicId }: { topicId: string }) {
  const t = useTranslations("topic.resume");
  const [saved, setSaved] = useState<ReadingPosition | null>(null);
  const record = useProgressRecorder();
  const { data: stored, isSuccess: storedLoaded } = useTopicProgress(topicId);
  const recordRef = useRef(record);
  useEffect(() => {
    recordRef.current = record;
  });
  // Davom ettirish qarori qabul qilingan (hash, shu qurilma yoki server) — qayta taklif qilmaymiz.
  const decided = useRef(false);

  useEffect(() => {
    decided.current = false;
    let active = true;
    Promise.resolve(useReadingStore.persist.rehydrate()).then(() => {
      if (!active) return;
      recordRef.current({ type: "topic_opened", topicId });
      // Ekranga to'liq sig'adigan qisqa mavzu aylantirilmaydi: ochilishining o'zi o'qilgan hisoblanadi.
      if (document.documentElement.scrollHeight - window.innerHeight <= 0) {
        recordRef.current({ type: "topic_read", topicId, source: "scroll" });
      }
      const hashed = BLOCK_HASH.exec(decodeURIComponent(window.location.hash))?.[1];
      const hashTarget = hashed ? findBlock(hashed) : null;
      if (hashTarget) {
        decided.current = true;
        hashTarget.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
        return;
      }
      const position = useReadingStore.getState().positions[topicId];
      if (
        position &&
        position.scroll >= MIN_RESUME_SCROLL &&
        position.scroll <= MAX_RESUME_SCROLL &&
        window.scrollY < 100
      ) {
        decided.current = true;
        setSaved(position);
      }
    });
    return () => {
      active = false;
    };
  }, [topicId]);

  // Shu qurilmada saqlangan joy yo'q, lekin progressda oxirgi blok bor (boshqa qurilmada o'qilgan).
  const serverBlock = stored?.lastBlockId;
  const readDone = stored?.readStatus === "completed";
  const serverUpdatedAt = stored?.updatedAt;
  useEffect(() => {
    if (decided.current || !storedLoaded || !serverBlock || readDone || window.scrollY >= 100) {
      return;
    }
    if (!findBlock(serverBlock)) return;
    decided.current = true;
    // Taklif DOM tekshiruvidan keyin ko'rsatiladi (effect ichida sinxron setState emas).
    let active = true;
    void Promise.resolve().then(() => {
      if (active) {
        setSaved({ scroll: NO_SCROLL, lastBlockId: serverBlock, updatedAt: serverUpdatedAt ?? "" });
      }
    });
    return () => {
      active = false;
    };
  }, [storedLoaded, serverBlock, readDone, serverUpdatedAt]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const save = () => {
      timer = undefined;
      const position = currentPosition();
      useReadingStore.getState().savePosition(topicId, position);
      if (position.scroll >= READ_COMPLETED_SCROLL) {
        recordRef.current({
          type: "topic_read",
          topicId,
          source: "scroll",
          lastBlockId: position.lastBlockId,
        });
      } else if (position.lastBlockId) {
        recordRef.current({ type: "reading_moved", topicId, lastBlockId: position.lastBlockId });
      }
    };
    const onScroll = () => {
      if (timer === undefined) timer = setTimeout(save, SAVE_DELAY_MS);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [topicId]);

  if (!saved) return null;

  const resume = () => {
    const behavior = scrollBehavior();
    const target = saved.lastBlockId ? findBlock(saved.lastBlockId) : null;
    if (target) {
      target.scrollIntoView({ behavior, block: "start" });
    } else {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: saved.scroll * scrollable, behavior });
    }
    setSaved(null);
  };

  return (
    <div
      role="status"
      className="border-border bg-primary-soft text-primary-soft-foreground present:hidden flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-4 py-3 text-sm print:hidden"
    >
      <p className="flex-1">{t("message")}</p>
      <Button size="sm" onClick={resume}>
        {t("action")}
      </Button>
      <button
        type="button"
        aria-label={t("dismiss")}
        onClick={() => setSaved(null)}
        className="hover:bg-primary-100/50 inline-flex size-8 items-center justify-center rounded-md"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
