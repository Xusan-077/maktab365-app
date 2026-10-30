"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * O'yin ichidagi modal (natija oynalari): native `<dialog>` — fokus tuzog'i va fon `inert`, Esc bilan
 * yopilmaydi. `underBanner` — Sirli quti savoli: banner ostida, modal emas (ovoz tugmasi va chiqish
 * ishlaydi; Esc'ni o'yin o'zi ushlaydi). Mount bo'lganda ochiladi; unmount'da yopiladi (Next
 * `<Activity>` yashirgan sahifa `inert` qolmasin).
 */
export function GameDialog({
  labelledBy,
  underBanner = false,
  className,
  children,
  testId,
}: {
  labelledBy: string;
  underBanner?: boolean;
  className?: string;
  children: ReactNode;
  testId?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) {
      if (underBanner) dialog.show();
      else dialog.showModal();
    }
    return () => dialog?.close();
  }, [underBanner]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onCancel={(event) => event.preventDefault()}
      className={cn(
        "font-game game-anim-fade m-0 max-h-none w-full max-w-none overflow-y-auto bg-[rgb(15_23_42/0.6)] backdrop:bg-transparent",
        underBanner
          ? "fixed inset-x-0 top-[110px] bottom-0 z-20 h-auto p-2.5 min-[721px]:top-[130px] min-[721px]:px-7 min-[721px]:py-3.5"
          : "h-dvh p-4",
      )}
      data-testid={testId}
    >
      <div
        className={cn(
          "flex min-h-full justify-center",
          underBanner ? "items-start" : "items-center",
        )}
      >
        <div
          className={cn(
            "game-anim-modal bg-surface text-foreground relative w-full overflow-hidden shadow-[0_10px_30px_rgb(0_0_0/0.3)]",
            className,
          )}
        >
          {children}
        </div>
      </div>
    </dialog>
  );
}
