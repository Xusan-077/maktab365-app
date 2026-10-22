"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/Skeleton";

// pdf.js faqat brauzerda ishlaydi: SSR'siz va faqat shu sahifada yuklanadi.
const PdfReader = dynamic(() => import("./PdfReader").then((module) => module.PdfReader), {
  ssr: false,
  loading: () => <Skeleton className="h-96" />,
});

/** Server sahifa uchun client chegarasi: `useSearchParams` Suspense talab qiladi. */
export function PdfReaderLoader({ bookId }: { bookId: string }) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <PdfReader bookId={bookId} />
    </Suspense>
  );
}
