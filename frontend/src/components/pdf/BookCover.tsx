"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface BookCoverProps {
  src?: string | null;
  className?: string;
}

/** Darslik muqovasi: har doim 3:4; manba yo'q yoki yuklanmasa ikonkali zaxira ko'rinadi. */
export function BookCover({ src, className }: BookCoverProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src) && failedSrc !== src;
  return (
    <div
      className={cn(
        "bg-subtle border-border text-muted relative flex aspect-[3/4] shrink-0 items-center justify-center overflow-hidden rounded-md border",
        className,
      )}
    >
      {showImage ? (
        // Backend/R2 manzili (tashqi domen): next/image sozlamasi shart emas.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src ?? undefined}
          alt=""
          loading="lazy"
          onError={() => setFailedSrc(src ?? null)}
          className="size-full object-cover"
        />
      ) : (
        <FileText className="size-8" aria-hidden />
      )}
    </div>
  );
}
