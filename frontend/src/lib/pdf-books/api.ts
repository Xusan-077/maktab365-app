import { createHttpClient, toApiError, unwrap, type HttpClient } from "@/lib/api/http-client";
import type { components } from "@/lib/api/schema";

type Schemas = components["schemas"];

export type PdfBook = Schemas["PdfBook"];
export type PdfBookDetail = Schemas["PdfBookDetail"];
export type PdfFileUrl = Schemas["PdfFileUrl"];
export type PdfProgress = Schemas["PdfProgress"];
export type PdfSubject = Schemas["Subject"];
export type GuestPdfProgress = Schemas["GuestPdfProgressRequest"];
export type PdfBookmark = Schemas["PdfBookmark"];
export type PdfLibrary = Schemas["PdfLibrary"];
export type PdfLibraryItem = Schemas["PdfLibraryItem"];
export type ReadStatus = Schemas["ReadStatusEnum"];
export type Dashboard = Schemas["Dashboard"];
export type DashboardSubject = Schemas["DashboardSubject"];
export type TeacherDashboard = Schemas["TeacherDashboard"];
export type Results = Schemas["Results"];
export type Goal = Schemas["Goal"];
export type GoalInput = Schemas["GoalWriteRequest"];
export type GoalPatch = Schemas["PatchedGoalWriteRequest"];
export type PdfDownload = Schemas["PdfDownload"];
export type ChapterHit = Schemas["ChapterHit"];
export type GuestAnnotation = Schemas["GuestAnnotationRequest"];
export type ReadEvent = Schemas["EventKindEnum"];

export const PDF_PAGE_SIZE = 24;

export interface PdfBookFilters {
  grade?: number;
  subject?: string;
  q?: string;
  page?: number;
  /** `newest` — so'nggi qo'shilganlar birinchi (standart: sinf va fan bo'yicha). */
  ordering?: "newest";
  /** Standart 24; sinf sahifasi hamma kitobni bir so'rovda oladi (backend chegarasi 100). */
  pageSize?: number;
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
          ordering: filters.ordering,
          page: filters.page,
          page_size: filters.pageSize ?? PDF_PAGE_SIZE,
        },
      },
    });
    return unwrap(result);
  }

  /** PDF darsligi bor fanlar (`books_count` — PDF soni); `includeEmpty` — admin paneldagi barcha fanlar. */
  async subjects(grade?: number, includeEmpty = false): Promise<PdfSubject[]> {
    const result = await this.client.GET("/api/v1/pdf-books/subjects/", {
      params: { query: { grade, include_empty: includeEmpty || undefined } },
    });
    return unwrap(result);
  }

  async book(id: string): Promise<PdfBookDetail> {
    const result = await this.client.GET("/api/v1/pdf-books/{id}/", { params: { path: { id } } });
    return unwrap(result);
  }

  /** Anonim statistika hodisasi (ochilish yoki sahifa); javobsiz, xato bo'lsa jim. */
  async recordStat(id: string, event: { kind: "open" } | { kind: "page"; page: number }) {
    await this.client.POST("/api/v1/pdf-books/{id}/stats/", {
      params: { path: { id } },
      body: event,
    });
  }

  /** Mundarija bo'limlari bo'yicha qidiruv (ko'rinadigan kitoblarda). */
  async searchChapters(q: string): Promise<ChapterHit[]> {
    return unwrap(await this.client.GET("/api/v1/pdf-books/search/", { params: { query: { q } } }));
  }

  /** Kitob slug bo'yicha (`9-sinf-algebra`). */
  async bookBySlug(slug: string): Promise<PdfBookDetail> {
    const result = await this.client.GET("/api/v1/pdf-books/by-slug/{slug}/", {
      params: { path: { slug } },
    });
    return unwrap(result);
  }

  /** Yuklab olish URL'i (`attachment`); yuklab olishlar sonini oshiradi. O'chirilgan bo'lsa 403 `download_disabled`. */
  async download(id: string): Promise<PdfDownload> {
    const result = await this.client.GET("/api/v1/pdf-books/{id}/download/", {
      params: { path: { id } },
    });
    return unwrap(result);
  }

  /** Qisqa muddatli o'qish URL'i (keshlanmaydi). */
  async fileUrl(id: string): Promise<PdfFileUrl> {
    const result = await this.client.GET("/api/v1/pdf-books/{id}/file-url/", {
      params: { path: { id } },
    });
    return unwrap(result);
  }

  /** Bo'lim prezentatsiyasining qisqa muddatli o'qish URL'i (keshlanmaydi). */
  async slidesUrl(bookId: string, chapterId: string): Promise<PdfFileUrl> {
    const result = await this.client.GET("/api/v1/pdf-books/{id}/chapters/{chapter_id}/slides/", {
      params: { path: { id: bookId, chapter_id: chapterId } },
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

  /** Kabinet bosh sahifasi: oxirgi ochilgan kitoblar (birinchisi — "davom ettirish") va saqlanganlar soni. */
  async library(): Promise<PdfLibrary> {
    return unwrap(await this.client.GET("/api/v1/me/library/"));
  }

  /** Saqlangan kitoblar, eng yangisi birinchi. */
  async bookmarks(): Promise<PdfBookmark[]> {
    return unwrap(await this.client.GET("/api/v1/me/pdf-bookmarks/"));
  }

  /** Idempotent: takror saqlash xavfsiz. */
  async addBookmark(id: string): Promise<PdfBookmark> {
    const result = await this.client.PUT("/api/v1/me/pdf-bookmarks/{pdf_book_id}/", {
      params: { path: { pdf_book_id: id } },
    });
    return unwrap(result);
  }

  /** Idempotent: saqlanmagan kitobni olib tashlash xato emas. */
  async removeBookmark(id: string): Promise<void> {
    const result = await this.client.DELETE("/api/v1/me/pdf-bookmarks/{pdf_book_id}/", {
      params: { path: { pdf_book_id: id } },
    });
    if (result.response.status >= 400) throw toApiError(result.response, result.error);
  }

  /** O'qish hodisasi (kitob ochildi / o'qib bo'lindi); idempotent. */
  async recordEvent(id: string, event: ReadEvent): Promise<PdfProgress> {
    const result = await this.client.POST("/api/v1/me/events/", {
      body: { kind: event, pdf_book_id: id },
    });
    return unwrap(result);
  }

  /** Kabinet bosh sahifasi: davom ettirish, fanlarim, takrorlash kerak, haftalik natija. */
  async dashboard(): Promise<Dashboard> {
    return unwrap(await this.client.GET("/api/v1/me/dashboard/"));
  }

  /** Ustoz bosh sahifasi (faqat `teacher` roli). */
  async teacherDashboard(): Promise<TeacherDashboard> {
    return unwrap(await this.client.GET("/api/v1/me/teacher/dashboard/"));
  }

  /** Natijalar: o'qilgan, jarayondagi va takrorlash kerak kitoblar. */
  async results(): Promise<Results> {
    return unwrap(await this.client.GET("/api/v1/me/results/"));
  }

  async goals(): Promise<Goal[]> {
    return unwrap(await this.client.GET("/api/v1/me/goals/"));
  }

  async createGoal(input: GoalInput): Promise<Goal> {
    return unwrap(await this.client.POST("/api/v1/me/goals/", { body: input }));
  }

  async updateGoal(id: string, patch: GoalPatch): Promise<Goal> {
    const result = await this.client.PATCH("/api/v1/me/goals/{goal_id}/", {
      params: { path: { goal_id: id } },
      body: patch,
    });
    return unwrap(result);
  }

  /** Idempotent: o'chirilgan rejani qayta o'chirish xato emas. */
  async deleteGoal(id: string): Promise<void> {
    const result = await this.client.DELETE("/api/v1/me/goals/{goal_id}/", {
      params: { path: { goal_id: id } },
    });
    if (result.response.status >= 400) throw toApiError(result.response, result.error);
  }

  /**
   * Mehmon ma'lumotini akkauntga qo'shadi (`merge-guest-data/`): oxirgi sahifalar va saqlangan
   * kitoblar. Qo'shilmagan id'lar `failed`.
   */
  async mergeGuest(data: {
    progress?: GuestPdfProgress[];
    bookmarks?: string[];
    annotations?: GuestAnnotation[];
  }): Promise<{
    pdf_progress: number;
    pdf_bookmarks: number;
    pdf_annotations: number;
    failed: string[];
  }> {
    const result = await this.client.POST("/api/v1/me/merge-guest-data/", {
      body: {
        pdf_progress: data.progress ?? [],
        pdf_bookmarks: data.bookmarks ?? [],
        pdf_annotations: data.annotations ?? [],
      },
    });
    const merged = unwrap(result);
    return {
      pdf_progress: merged.pdf_progress,
      pdf_bookmarks: merged.pdf_bookmarks,
      pdf_annotations: merged.pdf_annotations,
      failed: merged.failed,
    };
  }

  /** Kitobdagi mening belgilarim. */
  async listAnnotations(bookId: string) {
    return unwrap(
      await this.client.GET("/api/v1/me/pdf-annotations/", {
        params: { query: { pdf_book: bookId } },
      }),
    );
  }

  /** Idempotent: `id` mijozda yaratilgan UUID. */
  async saveAnnotation(annotation: {
    id: string;
    pdf_book_id: string;
    page: number;
    color: "yellow" | "green" | "pink";
    rects: { x: number; y: number; w: number; h: number }[];
    note: string;
  }) {
    const { id, ...body } = annotation;
    return unwrap(
      await this.client.PUT("/api/v1/me/pdf-annotations/{annotation_id}/", {
        params: { path: { annotation_id: id } },
        body,
      }),
    );
  }

  /** Idempotent. */
  async deleteAnnotation(id: string): Promise<void> {
    const result = await this.client.DELETE("/api/v1/me/pdf-annotations/{annotation_id}/", {
      params: { path: { annotation_id: id } },
    });
    if (result.response.status >= 400) throw toApiError(result.response, result.error);
  }
}

let instance: PdfBooksApi | undefined;

export function getPdfBooksApi(): PdfBooksApi {
  instance ??= new PdfBooksApi();
  return instance;
}
