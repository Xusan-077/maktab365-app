"use client";

import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/Skeleton";

/** Kitob ochilguncha: sahifa o'lchamidagi joy (sayt temasida; o'qish fon rejimi hali noma'lum). */
export function BookReaderSkeleton() {
  const t = useTranslations("books.reader");
  return (
    <div
      role="status"
      aria-label={t("skeleton")}
      className="bg-subtle flex h-dvh items-center justify-center p-6"
    >
      <Skeleton className="aspect-[2/3] max-h-[80dvh] w-full max-w-md rounded-sm" />
    </div>
  );
}
