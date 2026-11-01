import type { BookDetail } from "@/lib/books/api";
import type { PdfBookDetail } from "@/lib/pdf-books/api";

/**
 * Kutubxona kitobini (`Book`) darslik o'qish oynasi (`PdfReader`) kutadigan shaklga keltiradi:
 * oyna faqat quyidagi maydonlarni o'qiydi (sarlavha, bet soni, matn qatlami, mundarija). Darslikka
 * xos maydonlar (sinf, fan, oflayn, taqdimot) bo'sh qoladi; oyna `library` bo'lganda ularni ishlatmaydi.
 */
export function libraryAsPdfBook(book: BookDetail): PdfBookDetail {
  return {
    id: book.id,
    slug: book.slug,
    title: { uz: book.title },
    grade: book.grade_level ?? 0,
    subject: "",
    subject_title: { uz: book.author },
    page_count: book.page_count,
    size_bytes: 0,
    has_text_layer: book.has_text_layer,
    unverified: false,
    chapters: book.chapters.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      page: chapter.start_page,
      slides: null,
      children: [],
    })),
  } as unknown as PdfBookDetail;
}
