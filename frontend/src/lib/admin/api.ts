import { createHttpClient, unwrap, type HttpClient } from "@/lib/api/http-client";
import {
  PAGE_SIZE,
  type AdminBook,
  type AdminBookInput,
  type AdminBookPatch,
  type AdminChapter,
  type AdminChapterInput,
  type AdminChapterPatch,
  type AdminDashboard,
  type AdminPdfBook,
  type AdminPdfBookInput,
  type AdminPdfBookPatch,
  type AdminSubject,
  type AdminSubjectInput,
  type AdminSubjectPatch,
  type AdminTopic,
  type AdminTopicInput,
  type AdminTopicItem,
  type AdminTopicPatch,
  type AdminUser,
  type BookListParams,
  type Page,
  type PdfBookStatus,
  type PdfUploadPart,
  type PdfUploadPlan,
  type ReorderInput,
  type TopicStatus,
  type UploadKind,
  type UploadResult,
} from "./types";

const MAX_PAGE_SIZE = 100;
const MAX_PAGES = 20;

type Deleted = { error?: unknown; response: Response };

/** Admin API (`/api/v1/admin/`): brauzerda BFF orqali, kirgan editor/admin nomidan. */
export class AdminApi {
  constructor(private readonly client: HttpClient = createHttpClient()) {}

  async dashboard(): Promise<AdminDashboard> {
    return unwrap(await this.client.GET("/api/v1/admin/dashboard/"));
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

  async books(params: BookListParams = {}): Promise<Page<AdminBook>> {
    const { page, search, grade, subject, status, ordering } = params;
    const result = await this.client.GET("/api/v1/admin/books/", {
      params: {
        query: {
          page,
          page_size: PAGE_SIZE,
          search: search || undefined,
          grade,
          subject: subject || undefined,
          status,
          ordering,
        },
      },
    });
    return unwrap(result);
  }

  async book(id: string): Promise<AdminBook> {
    const result = await this.client.GET("/api/v1/admin/books/{id}/", {
      params: { path: { id } },
    });
    return unwrap(result);
  }

  async createBook(input: AdminBookInput): Promise<AdminBook> {
    return unwrap(await this.client.POST("/api/v1/admin/books/", { body: input }));
  }

  async updateBook(id: string, patch: AdminBookPatch): Promise<AdminBook> {
    const result = await this.client.PATCH("/api/v1/admin/books/{id}/", {
      params: { path: { id } },
      body: patch,
    });
    return unwrap(result);
  }

  async deleteBook(id: string): Promise<void> {
    this.assertDeleted(
      await this.client.DELETE("/api/v1/admin/books/{id}/", { params: { path: { id } } }),
    );
  }

  /** Boblar va mavzular tartibi bir so'rovda. */
  async reorder(bookId: string, input: ReorderInput): Promise<void> {
    const result = await this.client.POST("/api/v1/admin/books/{id}/reorder/", {
      params: { path: { id: bookId } },
      body: input,
    });
    unwrap(result);
  }

  async chapters(bookId: string): Promise<AdminChapter[]> {
    const items: AdminChapter[] = [];
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const result = await this.client.GET("/api/v1/admin/chapters/", {
        params: { query: { book: bookId, page, page_size: MAX_PAGE_SIZE } },
      });
      const data = unwrap(result);
      items.push(...data.results);
      if (items.length >= data.count) break;
    }
    return items;
  }

  async createChapter(input: AdminChapterInput): Promise<AdminChapter> {
    return unwrap(await this.client.POST("/api/v1/admin/chapters/", { body: input }));
  }

  async updateChapter(id: string, patch: AdminChapterPatch): Promise<AdminChapter> {
    const result = await this.client.PATCH("/api/v1/admin/chapters/{id}/", {
      params: { path: { id } },
      body: patch,
    });
    return unwrap(result);
  }

  async deleteChapter(id: string): Promise<void> {
    this.assertDeleted(
      await this.client.DELETE("/api/v1/admin/chapters/{id}/", { params: { path: { id } } }),
    );
  }

  /** Kitobning barcha mavzulari (yengil ko'rinish: bloklarsiz). */
  async topics(bookId: string): Promise<AdminTopicItem[]> {
    const items: AdminTopicItem[] = [];
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const result = await this.client.GET("/api/v1/admin/topics/", {
        params: { query: { book: bookId, page, page_size: MAX_PAGE_SIZE } },
      });
      const data = unwrap(result);
      items.push(...data.results);
      if (items.length >= data.count) break;
    }
    return items;
  }

  async topic(id: string): Promise<AdminTopic> {
    const result = await this.client.GET("/api/v1/admin/topics/{id}/", {
      params: { path: { id } },
    });
    return unwrap(result);
  }

  async createTopic(input: AdminTopicInput): Promise<AdminTopic> {
    return unwrap(await this.client.POST("/api/v1/admin/topics/", { body: input }));
  }

  async updateTopic(id: string, patch: AdminTopicPatch): Promise<AdminTopic> {
    const result = await this.client.PATCH("/api/v1/admin/topics/{id}/", {
      params: { path: { id } },
      body: patch,
    });
    return unwrap(result);
  }

  async deleteTopic(id: string): Promise<void> {
    this.assertDeleted(
      await this.client.DELETE("/api/v1/admin/topics/{id}/", { params: { path: { id } } }),
    );
  }

  async transition(id: string, to: TopicStatus): Promise<AdminTopic> {
    const result = await this.client.POST("/api/v1/admin/topics/{id}/transition/", {
      params: { path: { id } },
      body: { to },
    });
    return unwrap(result);
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

  async users(params: { page?: number; search?: string } = {}): Promise<Page<AdminUser>> {
    const result = await this.client.GET("/api/v1/admin/users/", {
      params: {
        query: { page: params.page, page_size: PAGE_SIZE, search: params.search || undefined },
      },
    });
    return unwrap(result);
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
