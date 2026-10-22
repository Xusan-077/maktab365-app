import { createHttpClient, unwrap, type HttpClient } from "@/lib/api/http-client";
import type { components } from "@/lib/api/schema";

type Schemas = components["schemas"];

export type PdfBook = Schemas["PdfBook"];
export type PdfFileUrl = Schemas["PdfFileUrl"];
export type PdfProgress = Schemas["PdfProgress"];
export type PdfSubject = Schemas["Subject"];
export type GuestPdfProgress = Schemas["GuestPdfProgressRequest"];

export const PDF_PAGE_SIZE = 24;

export interface PdfBookFilters {
  grade?: number;
  subject?: string;
  q?: string;
  page?: number;
}

export interface PdfBookPage {
  count: number;
  results: PdfBook[];
}

/** Ochiq PDF darsliklar va o'qish pozitsiyasi API'si (brauzerda BFF orqali, kirgan foydalanuvchi nomidan). */
export class PdfBooksApi {
  constructor(private readonly client: HttpClient = createHttpClient()) {}

  async list(filters: PdfBookFilters = {}): Promise<PdfBookPage> {
    const result = await this.client.GET("/api/v1/pdf-books/", {
      params: {
        query: {
          grade: filters.grade,
          subject: filters.subject || undefined,
          q: filters.q || undefined,
          page: filters.page,
          page_size: PDF_PAGE_SIZE,
        },
      },
    });
    return unwrap(result);
  }

  /** PDF darsligi bor fanlar (`books_count` — PDF soni). */
  async subjects(grade?: number): Promise<PdfSubject[]> {
    const result = await this.client.GET("/api/v1/pdf-books/subjects/", {
      params: { query: { grade } },
    });
    return unwrap(result);
  }

  async book(id: string): Promise<PdfBook> {
    const result = await this.client.GET("/api/v1/pdf-books/{id}/", { params: { path: { id } } });
    return unwrap(result);
  }

  /** Qisqa muddatli o'qish URL'i (keshlanmaydi). */
  async fileUrl(id: string): Promise<PdfFileUrl> {
    const result = await this.client.GET("/api/v1/pdf-books/{id}/file-url/", {
      params: { path: { id } },
    });
    return unwrap(result);
  }

  /** Mening oxirgi sahifam; yozuv yo'q bo'lsa `null`. */
  async myProgress(id: string): Promise<PdfProgress | null> {
    const result = await this.client.GET("/api/v1/me/pdf-progress/{pdf_book_id}/", {
      params: { path: { pdf_book_id: id } },
    });
    if (result.response.status === 404) return null;
    return unwrap(result);
  }

  async allProgress(): Promise<PdfProgress[]> {
    return unwrap(await this.client.GET("/api/v1/me/pdf-progress/"));
  }

  /** Idempotent: bir xil yozuv takror yuborilsa natija o'zgarmaydi; yangiroq `updatedAt` yutadi. */
  async saveProgress(id: string, page: number, updatedAt: string): Promise<PdfProgress> {
    const result = await this.client.PUT("/api/v1/me/pdf-progress/{pdf_book_id}/", {
      params: { path: { pdf_book_id: id } },
      body: { last_page: page, updated_at: updatedAt },
    });
    return unwrap(result);
  }

  /** Mehmon pozitsiyalarini akkauntga qo'shadi (`merge-guest-data/`); qo'shilmagan id'lar `failed`. */
  async mergeGuest(items: GuestPdfProgress[]): Promise<{ pdf_progress: number; failed: string[] }> {
    const result = await this.client.POST("/api/v1/me/merge-guest-data/", {
      body: { pdf_progress: items },
    });
    const data = unwrap(result);
    return { pdf_progress: data.pdf_progress, failed: data.failed };
  }
}

let instance: PdfBooksApi | undefined;

export function getPdfBooksApi(): PdfBooksApi {
  instance ??= new PdfBooksApi();
  return instance;
}
