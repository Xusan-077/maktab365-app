"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { GeneratedCover } from "./GeneratedCover";

export interface BookCoverProps {
  grade: number;
  subject: string;
  subjectTitle: string;
  /** Admin tanlagan muqova rasmi (custom / PDF 1-beti); bo'lmasa generativ muqova. */
  src?: string | null;
  /** Birinchi ekrandagi muqova (LCP) — darrov yuklanadi. */
  priority?: boolean;
  className?: string;
}

/**
 * Darslik muqovasi, nisbat 2:3. Rasm bo'lsa shu, aks holda `GeneratedCover`. Generativ muqova rasm
 * ostida doim turadi: rasm yuklanguncha o'rin egallaydi (layout shift yo'q), yuklanmasa yoki xato
 * bersa zaxira bo'lib qoladi.
 */
export function BookCover({
  grade,
  subject,
  subjectTitle,
  src,
  priority = false,
  className,
}: BookCoverProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const generated = (
    <GeneratedCover
      grade={grade}
      subject={subject}
      subjectTitle={subjectTitle}
      className={src ? "w-full" : className}
    />
  );
  if (!src || failedSrc === src) {
    return src ? <div className={className}>{generated}</div> : generated;
  }
  return (
    <div
      data-testid="book-cover-image"
      className={cn("relative aspect-[2/3] shrink-0 overflow-hidden rounded-md", className)}
    >
      {generated}
      {/* eslint-disable-next-line @next/next/no-img-element -- R2 manzili; o'lcham aspect-ratio bilan belgilangan */}
      <img
        src={src}
        alt=""
        width={600}
        height={900}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        onError={() => setFailedSrc(src)}
        className="absolute inset-0 size-full rounded-md object-cover shadow-sm"
      />
    </div>
  );
}
