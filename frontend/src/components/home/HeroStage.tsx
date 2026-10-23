"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils/cn";

interface HeroGradeState {
  /** Sinf tugmasi ustiga kelinganda tanlanadi; muqovalar shu sinfga o'tadi. */
  grade: number | null;
  setGrade: (grade: number | null) => void;
}

const HeroGradeContext = createContext<HeroGradeState>({ grade: null, setGrade: () => {} });

export function useHeroGrade() {
  return useContext(HeroGradeContext);
}

export interface HeroStageProps {
  labelledBy: string;
  className?: string;
  children: ReactNode;
}

/**
 * Hero qobig'i: sichqoncha harakatini `--hx/--hy` (−1…1) va `--mx/--my` (%) CSS o'zgaruvchilariga yozadi.
 * Parallaks, 3D og'ish va yorug'lik dog'i faqat CSS'da shu o'zgaruvchilardan foydalanadi (React qayta chizilmaydi).
 * Sensorli qurilma va `prefers-reduced-motion` da hech narsa bog'lanmaydi.
 */
export function HeroStage({ labelledBy, className, children }: HeroStageProps) {
  const ref = useRef<HTMLElement>(null);
  const [grade, setGrade] = useState<number | null>(null);
  const gradeState = useMemo(() => ({ grade, setGrade }), [grade]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!fine.matches || calm.matches) return;

    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    let frame = 0;

    const paint = () => {
      current.x += (target.x - current.x) * 0.12;
      current.y += (target.y - current.y) * 0.12;
      el.style.setProperty("--hx", current.x.toFixed(3));
      el.style.setProperty("--hy", current.y.toFixed(3));
      el.style.setProperty("--mx", `${((current.x + 1) * 50).toFixed(1)}%`);
      el.style.setProperty("--my", `${((current.y + 1) * 50).toFixed(1)}%`);
      const settled =
        Math.abs(target.x - current.x) < 0.001 && Math.abs(target.y - current.y) < 0.001;
      frame = settled ? 0 : requestAnimationFrame(paint);
    };
    const kick = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };

    const onMove = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      target.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      target.y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      el.dataset.active = "true";
      kick();
    };
    const onLeave = () => {
      target.x = 0;
      target.y = 0;
      el.dataset.active = "false";
      kick();
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section
      ref={ref}
      aria-labelledby={labelledBy}
      data-active="false"
      className={cn(
        "hero-bg hero-stage border-border relative overflow-hidden border-b",
        className,
      )}
    >
      <HeroGradeContext value={gradeState}>{children}</HeroGradeContext>
    </section>
  );
}
