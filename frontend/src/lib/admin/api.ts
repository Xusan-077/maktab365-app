import { createHttpClient, unwrap, type HttpClient } from "@/lib/api/http-client";
import {
  PAGE_SIZE,
  type AdminDashboard,
  type AdminPdfBook,
  type AdminPdfBookInput,
  type AdminStats,
  type AdminPdfBookPatch,
  type AdminSubject,
  type AdminSubjectInput,
  type AdminSubjectPatch,
  type AdminUser,
  type AdminUserCreated,
  type AdminUserInput,
  type AdminUserPatch,
  type BookListParams,
  type Page,
  type PdfBookStatus,
  type PdfUploadPart,
  type PdfUploadPlan,
  type UploadKind,
  type UploadResult,
  type UserListParams,
} from "./types";

const MAX_PAGE_SIZE = 100;

type Deleted = { error?: unknown; response: Response };

/** Admin API (`/api/v1/admin/`): brauzerda BFF orqali, kirgan editor/admin nomidan. */
export class AdminApi {
  constructor(private readonly client: HttpClient = createHttpClient()) {}

  async dashboard(): Promise<AdminDashboard> {
    return unwrap(await this.client.GET("/api/v1/admin/dashboard/"));
  }

  /** Anonim sonlar: oxirgi `days` (7 yoki 30) kun. */
  async stats(days: 7 | 30): Promise<AdminStats> {
    return unwrap(await this.client.GET("/api/v1/admin/stats/", { params: { query: { days } } }));
  }

  async subjects(): Promise<AdminSubject[]> {
    const result = await this.client.GET("/api/v1/admin/subjects/", {
      params: { query: { page_size: MAX_PAGE_SIZE } },
    });
    return unwrap(result).results;
  }

  async createSubject(input: AdminSubjectInput): Promise<AdminSubject> {
    return unwrap(await this.client.POST("/api/v1/admin/subjects/", { body: input }));
  }

  async updateSubject(id: string, patch: AdminSubjectPatch): Promise<AdminSubject> {
    const result = await this.client.PATCH("/api/v1/admin/subjects/{id}/", {
      params: { path: { id } },
      body: patch,
    });
    return unwrap(result);
  }

  async deleteSubject(id: string): Promise<void> {
    this.assertDeleted(
      await this.client.DELETE("/api/v1/admin/subjects/{id}/", { params: { path: { id } } }),
    );
  }

  async upload(file: File, kind: UploadKind): Promise<UploadResult> {
    const result = await this.client.POST("/api/v1/admin/uploads/", {
      body: { file: "", kind },
      // multipart: Content-Type'ni brauzer chegara (boundary) bilan o'zi qo'yadi.
      bodySerializer: () => {
        const form = new FormData();
        form.set("kind", kind);
        form.set("file", file);
        return form;
      },
    });
    return unwrap(result);
  }

  async pdfBooks(params: BookListParams = {}): Promise<Page<AdminPdfBook>> {
    const { page, search, grade, subject, status } = params;
    const result = await this.client.GET("/api/v1/admin/pdf-books/", {
      params: {
        query: {
          page,
          page_size: PAGE_SIZE,
          search: search || undefined,
          grade,
          subject: subject || undefined,
          status,
        },
      },
    });
    return unwrap(result);
  }

  async pdfBook(id: string): Promise<AdminPdfBook> {
    const result = await this.client.GET("/api/v1/admin/pdf-books/{id}/", {
      params: { path: { id } },
    });
    return unwrap(result);
  }

  async createPdfBook(input: AdminPdfBookInput): Promise<AdminPdfBook> {
    return unwrap(await this.client.POST("/api/v1/admin/pdf-books/", { body: input }));
  }

  async updatePdfBook(id: string, patch: AdminPdfBookPatch): Promise<AdminPdfBook> {
    const result = await this.client.PATCH("/api/v1/admin/pdf-books/{id}/", {
      params: { path: { id } },
      body: patch,
    });
    return unwrap(result);
  }

  async deletePdfBook(id: string): Promise<void> {
    this.assertDeleted(
      await this.client.DELETE("/api/v1/admin/pdf-books/{id}/", { params: { path: { id } } }),
    );
  }

  /** Qoralama nusxa: tavsif va mundarija ko'chadi, PDF fayl yo'q. */
  async duplicatePdfBook(id: string): Promise<AdminPdfBook> {
    const result = await this.client.POST("/api/v1/admin/pdf-books/{id}/duplicate/", {
      params: { path: { id } },
    });
    return unwrap(result);
  }

  async transitionPdfBook(id: string, to: PdfBookStatus): Promise<AdminPdfBook> {
    const result = await this.client.POST("/api/v1/admin/pdf-books/{id}/transition/", {
      params: { path: { id } },
      body: { to },
    });
    return unwrap(result);
  }

  /** PDF yuklashni boshlaydi: S3'ga to'g'ridan-to'g'ri (`direct`) yoki backend orqali (`proxy`, dev). */
  async initPdfUpload(
    id: string,
    file: { name: string; size: number; type: string },
  ): Promise<PdfUploadPlan> {
    const result = await this.client.POST("/api/v1/admin/pdf-books/{id}/upload-init/", {
      params: { path: { id } },
      body: { filename: file.name, size: file.size, content_type: file.type },
    });
    return unwrap(result);
  }

  async completePdfUpload(id: string, parts: PdfUploadPart[]): Promise<AdminPdfBook> {
    const result = await this.client.POST("/api/v1/admin/pdf-books/{id}/upload-complete/", {
      params: { path: { id } },
      body: { parts },
    });
    return unwrap(result);
  }

  // --- Bo'lim prezentatsiyalari (ixtiyoriy PDF slaydlar) ---

  async initSlidesUpload(
    bookId: string,
    chapterId: string,
    file: { name: string; size: number; type: string },
  ): Promise<PdfUploadPlan> {
    const result = await this.client.POST(
      "/api/v1/admin/pdf-books/{id}/chapters/{chapter_id}/slides/upload-init/",
      {
        params: { path: { id: bookId, chapter_id: chapterId } },
        body: { filename: file.name, size: file.size, content_type: file.type },
      },
    );
    return unwrap(result);
  }

  async completeSlidesUpload(
    bookId: string,
    chapterId: string,
    parts: PdfUploadPart[],
    filename: string,
  ): Promise<AdminPdfBook> {
    const result = await this.client.POST(
      "/api/v1/admin/pdf-books/{id}/chapters/{chapter_id}/slides/upload-complete/",
      { params: { path: { id: bookId, chapter_id: chapterId } }, body: { parts, filename } },
    );
    return unwrap(result);
  }

  /** Tugallanmagan yuklashni bekor qiladi (joriy prezentatsiyaga tegmaydi). */
  async abortSlidesUpload(bookId: string, chapterId: string): Promise<void> {
    const result = await this.client.POST(
      "/api/v1/admin/pdf-books/{id}/chapters/{chapter_id}/slides/upload-abort/",
      { params: { path: { id: bookId, chapter_id: chapterId } } },
    );
    this.assertDeleted(result);
  }

  /** Prezentatsiyani olib tashlaydi (faqat admin); yangilangan kitobni qaytaradi. */
  async deleteSlides(bookId: string, chapterId: string): Promise<AdminPdfBook> {
    const result = await this.client.DELETE(
      "/api/v1/admin/pdf-books/{id}/chapters/{chapter_id}/slides/",
      { params: { path: { id: bookId, chapter_id: chapterId } } },
    );
    return unwrap(result);
  }

  async users(params: UserListParams = {}): Promise<Page<AdminUser>> {
    const result = await this.client.GET("/api/v1/admin/users/", {
      params: {
        query: {
          page: params.page,
          page_size: PAGE_SIZE,
          search: params.search || undefined,
          role: params.role,
          status: params.status,
        },
      },
    });
    return unwrap(result);
  }

  async createUser(input: AdminUserInput): Promise<AdminUserCreated> {
    return unwrap(await this.client.POST("/api/v1/admin/users/", { body: input }));
  }

  async updateUser(id: string, patch: AdminUserPatch): Promise<AdminUser> {
    const result = await this.client.PATCH("/api/v1/admin/users/{id}/", {
      params: { path: { id } },
      body: patch,
    });
    return unwrap(result);
  }

  async deleteUser(id: string): Promise<void> {
    this.assertDeleted(
      await this.client.DELETE("/api/v1/admin/users/{id}/", { params: { path: { id } } }),
    );
  }

  private assertDeleted(result: Deleted): void {
    if (result.error !== undefined) unwrap({ error: result.error, response: result.response });
  }
}

let instance: AdminApi | undefined;

export function getAdminApi(): AdminApi {
  instance ??= new AdminApi();
  return instance;
}
