"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { m } from "@/components/ui/motion";
import { cn } from "@/lib/utils/cn";

/**
 * O'yin ichidagi modal (quti savoli, arqon g'olibi): native `<dialog>` — fokus tuzog'i va fon
 * `inert`. Esc bilan yopilmaydi (javobsiz chiqib bo'lmaydi), faqat ichidagi tugma bilan.
 * Mount bo'lganda ochiladi; unmount'da yopiladi (Next `<Activity>` yashirgan sahifa `inert` qolmasin).
 */
export function GameDialog({
  labelledBy,
  className,
  children,
  testId,
}: {
  labelledBy: string;
  className?: string;
  children: ReactNode;
  testId?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onCancel={(event) => event.preventDefault()}
      className="font-game m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto bg-transparent p-0 backdrop:bg-transparent"
      data-testid={testId}
    >
      <m.div
        aria-hidden
        className="bg-overlay fixed inset-0 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 0.2 } }}
      />
      <div className="relative flex min-h-full items-center justify-center p-3 sm:p-6">
        <m.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
            transition: { type: "spring", stiffness: 380, damping: 30 },
          }}
          className={cn(
            "bg-surface text-foreground w-full overflow-hidden rounded-[2rem] shadow-[0_30px_80px_-30px_rgb(15_23_42/0.6)]",
            className,
          )}
        >
          {children}
        </m.div>
      </div>
    </dialog>
  );
}
