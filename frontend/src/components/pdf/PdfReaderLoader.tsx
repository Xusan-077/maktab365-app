"use client";

import { Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/Skeleton";
import type { BookDetail } from "@/lib/books/api";
import { pdfQueries } from "@/lib/pdf-books/queries";

// pdf.js faqat brauzerda ishlaydi: SSR'siz va faqat shu sahifada yuklanadi.
const PdfReader = dynamic(() => import("./PdfReader").then((module) => module.PdfReader), {
  ssr: false,
  loading: () => <Skeleton className="h-96" />,
});

/**
 * Kitob serverda topilmaganda (qoralama: faqat staff ko'radi) slug mijozda, BFF orqali (sessiya
 * bilan) aniqlanadi; topilmasa o'qish oynasi o'zi "topilmadi" xabarini ko'rsatadi.
 */
function PdfReaderBySlug({ slug, backHref }: { slug: string; backHref?: string }) {
  const book = useQuery(pdfQueries.bookBySlug(slug));
  if (book.isPending) return <Skeleton className="h-96" />;
  return <PdfReader bookId={book.data?.id ?? slug} backHref={backHref} />;
}

/**
 * Server sahifa uchun client chegarasi: `useSearchParams` Suspense talab qiladi. Darslik ham,
 * kutubxona kitobi (`library`) ham bitta o'qish oynasida ochiladi.
 */
export function PdfReaderLoader(
  props: ({ bookId: string } | { slug: string } | { library: BookDetail }) & {
    backHref?: string;
    preview?: boolean;
  },
) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      {"library" in props ? (
        <PdfReader bookId={props.library.id} library={props.library} backHref={props.backHref} />
      ) : "bookId" in props ? (
        <PdfReader bookId={props.bookId} backHref={props.backHref} preview={props.preview} />
      ) : (
        <PdfReaderBySlug slug={props.slug} backHref={props.backHref} />
      )}
    </Suspense>
  );
}
