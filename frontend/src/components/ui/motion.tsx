"use client";

import type { ReactNode } from "react";
import { AnimatePresence, LazyMotion, MotionConfig, m, type Variants } from "framer-motion";

export { AnimatePresence, m };

const loadFeatures = () => import("./motion-features").then((mod) => mod.default);

/** Tez va tabiiy: chiqishda sekinlashadi. Faqat transform va opacity animatsiya qilinadi. */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** `prefers-reduced-motion` yoqilgan bo'lsa transformlar o'chadi (faqat opacity qoladi). */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}

/** Ro'yxat elementi: kichik fade + slide; stagger 12 tadan keyin to'xtaydi (uzun ro'yxat kechikmasin). */
export const listItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: (index: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: EASE_OUT, delay: Math.min(index, 12) * 0.03 },
  }),
};

/** Menyu/popover: yuqori-o'ngdan ochiladi, tez yopiladi. */
export const popover: Variants = {
  hidden: { opacity: 0, y: -4, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.16, ease: EASE_OUT } },
  exit: { opacity: 0, y: -4, scale: 0.97, transition: { duration: 0.12 } },
};
