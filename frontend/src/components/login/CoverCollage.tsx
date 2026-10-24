"use client";

import { useTranslations } from "next-intl";
import { m } from "@/components/ui/motion";
import type { PdfBook } from "@/lib/pdf-books/api";
import { CoverTile } from "./CoverTile";

/** Har kitob: o'rni, o'lchami, burchagi va suzish kechikishi (kattasi — o'rtadagi). */
const SLOTS = [
  { left: "1%", bottom: 34, w: 150, h: 200, rotate: -9, duration: 7, delay: 0 },
  { left: "23%", bottom: 0, w: 170, h: 226, rotate: -3, duration: 6, delay: 1.2 },
  { left: "47%", bottom: 40, w: 150, h: 200, rotate: 4, duration: 8, delay: 2.4 },
  { left: "69%", bottom: 12, w: 150, h: 200, rotate: 10, duration: 7, delay: 0.6 },
] as const;

/**
 * Brend panelidagi so'nggi qo'shilgan 4 ta kitob muqovasi. Juda sekin suzadi (y ±6px);
 * `prefers-reduced-motion` yoqilgan bo'lsa (`MotionProvider`) animatsiya o'chadi.
 */
export function CoverCollage({ books }: { books: PdfBook[] }) {
  const t = useTranslations("login");
  if (books.length === 0) return null;
  return (
    <div role="img" aria-label={t("collageLabel")} className="relative mt-auto h-[300px] w-full">
      {books.slice(0, SLOTS.length).map((book, index) => {
        const slot = SLOTS[index];
        return (
          <m.div
            key={book.id}
            className="absolute"
            style={{
              left: slot.left,
              bottom: slot.bottom,
              rotate: slot.rotate,
              zIndex: index === 1 ? 2 : 1,
            }}
            animate={{ y: [0, -6, 0, 6, 0] }}
            transition={{
              duration: slot.duration,
              delay: slot.delay,
              ease: "easeInOut",
              repeat: Infinity,
            }}
          >
            <CoverTile book={book} width={slot.w} height={slot.h} />
          </m.div>
        );
      })}
    </div>
  );
}
