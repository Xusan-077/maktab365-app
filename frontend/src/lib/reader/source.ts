import type { ReactNode } from "react";
import type { PDFDocumentProxy } from "@/lib/pdf/pdfjs";
import type { BookChapter } from "@/lib/books/api";

/**
 * Yagona o'qish oynasi uchun kitob manbasi. Kutubxona kitobi (`Book`) ham, maktab darsligi
 * (`PdfBook`) ham shu shaklga keltiriladi: oyna kitob turini bilmaydi, faqat shu shartnomani ishlatadi.
 * Yozuvlar (chizma, belgi, yon daftar) ikkala turda ham bir xil `/me/books/<id>/…` manzillarida.
 */
export interface ReaderSource {
  kind: "library" | "textbook";
  id: string;
  title: string;
  /** Kitob nomidan boshqa qisqa izoh (muallif yoki sinf va fan). */
  subtitle: string | null;
  pageCount: number;
  chapters: readonly BookChapter[];
  /** `null` — noma'lum (eski yozuv): matn qatlami bor deb olinadi. */
  hasTextLayer: boolean | null;
  readingMode: "standard" | "fiction" | "math" | "test";
  /** «Orqaga» tugmasi: kitob sahifasi. */
  backHref: string;
  pdf: {
    doc: PDFDocumentProxy | null;
    loading: boolean;
    error: unknown;
    reload: () => void;
  };
  progress: {
    ready: boolean;
    /** Saqlangan oxirgi bet (`null` — hali o'qilmagan). */
    lastPage: number | null;
    save: (page: number) => void;
  };
  bookmarks: {
    pages: readonly number[];
    toggle: (page: number) => void;
    isBookmarked: (page: number) => boolean;
  };
  /** Kitob turiga xos qo'shimcha imkoniyatlar (darslik: Mavzu paneli, taqdimot, oflayn…). */
  slot?: ReaderSlot;
}

/** Oyna holati: qo'shimcha imkoniyatlar shundan foydalanadi. */
export interface ReaderContext {
  page: number;
  total: number;
  go: (page: number) => void;
  isDesktop: boolean;
}

/** Oynaning tashqaridan beriladigan qismlari: yuqori paneldagi tugmalar va ustki qatlamlar. */
export interface ReaderSlot {
  actions?: (context: ReaderContext) => ReactNode;
  overlays?: (context: ReaderContext) => ReactNode;
}

/** Darslik mundarijasi (`PdfBookDetail.chapters`: bob → bo'limlar) → tekis `BookChapter` ro'yxati. */
export function flattenChapters(
  chapters: readonly {
    id: string;
    title: string;
    page: number;
    children?: readonly { id: string; title: string; page: number }[];
  }[],
): BookChapter[] {
  return chapters.flatMap((chapter) => [
    { id: chapter.id, title: chapter.title, start_page: chapter.page },
    ...(chapter.children ?? []).map((child) => ({
      id: child.id,
      title: child.title,
      start_page: child.page,
    })),
  ]);
}
