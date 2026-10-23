"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { GeneratedCover } from "./GeneratedCover";

export interface BookCoverProps {
  /** Kitobning o'z muqovasi; yo'q yoki yuklanmasa generativ muqova ko'rinadi. */
  src?: string | null;
  grade: number;
  subject: string;
  subjectTitle: string;
  className?: string;
}

/**
 * Darslik muqovasi: har doim 3:4. O'z rasmi bo'lsa shu (umurtqa belgisi bilan), bo'lmasa generativ.
 * Katalog, bosh sahifa, panel va admin ro'yxati shu bitta komponentdan foydalanadi.
 */
export function BookCover({ src, grade, subject, subjectTitle, className }: BookCoverProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src) && failedSrc !== src;
  if (!showImage) {
    return (
      <GeneratedCover
        grade={grade}
        subject={subject}
        subjectTitle={subjectTitle}
        className={cn("shrink-0 shadow-sm", className)}
      />
    );
  }
  return (
    <div
      className={cn(
        "bg-subtle relative aspect-[3/4] shrink-0 overflow-hidden rounded-md shadow-sm",
        className,
      )}
    >
      {/* Backend/R2 manzili (tashqi domen): next/image sozlamasi shart emas. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src ?? undefined}
        alt=""
        loading="lazy"
        onError={() => setFailedSrc(src ?? null)}
        className="size-full object-cover"
      />
      <span className="cover-edge" aria-hidden />
      <span className="cover-shine" aria-hidden />
    </div>
  );
}
