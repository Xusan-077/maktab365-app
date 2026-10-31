import { createHttpClient, unwrap, type HttpClient } from "@/lib/api/http-client";
import type { components } from "@/lib/api/schema";
import type { AdminPdfBook, PdfUploadPart, PdfUploadPlan } from "@/lib/admin/types";

type Schemas = components["schemas"];

export type AdminBook = Schemas["BookAdmin"];
export type AdminBookInput = Schemas["BookAdminRequest"];
export type AdminBookPatch = Schemas["PatchedBookAdminRequest"];
export type AdminBookType = Schemas["BookTypeEnum"];
export type AdminBookStatus = Schemas["BookStatusEnum"];

export const LIBRARY_PAGE_SIZE = 20;

export interface LibraryListParams {
  page?: number;
  search?: string;
  type?: AdminBookType;
  status?: AdminBookStatus;
}

export interface LibraryPage {
  count: number;
  results: AdminBook[];
}

/** Kutubxona (kitoblar bo'limi) admin API'si: faqat staff, brauzerda BFF orqali. */
export class AdminLibraryApi {
  constructor(private readonly client: HttpClient = createHttpClient()) {}

  async list(params: LibraryListParams = {}): Promise<LibraryPage> {
    const result = await this.client.GET("/api/v1/admin/books/", {
      params: {
        query: {
          page: params.page,
          page_size: LIBRARY_PAGE_SIZE,
          search: params.search || undefined,
          type: params.type,
          status: params.status,
        },
      },
    });
    return unwrap(result);
  }

  async get(id: string): Promise<AdminBook> {
    return unwrap(await this.client.GET("/api/v1/admin/books/{id}/", { params: { path: { id } } }));
  }

  async create(input: AdminBookInput): Promise<AdminBook> {
    return unwrap(await this.client.POST("/api/v1/admin/books/", { body: input }));
  }

  async update(id: string, patch: AdminBookPatch): Promise<AdminBook> {
    const result = await this.client.PATCH("/api/v1/admin/books/{id}/", {
      params: { path: { id } },
      body: patch,
    });
    return unwrap(result);
  }

  async remove(id: string): Promise<void> {
    const result: { error?: unknown; response: Response } = await this.client.DELETE(
      "/api/v1/admin/books/{id}/",
      { params: { path: { id } } },
    );
    if (result.error !== undefined) unwrap({ error: result.error, response: result.response });
  }

  async transition(id: string, to: "draft" | "published"): Promise<AdminBook> {
    const result = await this.client.POST("/api/v1/admin/books/{id}/transition/", {
      params: { path: { id } },
      body: { to },
    });
    return unwrap(result);
  }

  async reprocess(id: string): Promise<AdminBook> {
    const result = await this.client.POST("/api/v1/admin/books/{id}/reprocess/", {
      params: { path: { id } },
    });
    return unwrap(result);
  }

  async initUpload(
    id: string,
    file: { name: string; size: number; type: string },
  ): Promise<PdfUploadPlan> {
    const result = await this.client.POST("/api/v1/admin/books/{id}/upload-init/", {
      params: { path: { id } },
      body: { filename: file.name, size: file.size, content_type: file.type },
    });
    return unwrap(result);
  }

  async completeUpload(id: string, parts: PdfUploadPart[]): Promise<AdminBook> {
    const result = await this.client.POST("/api/v1/admin/books/{id}/upload-complete/", {
      params: { path: { id } },
      body: { parts },
    });
    return unwrap(result);
  }

  /**
   * `uploadPdf` (`lib/admin/pdf-upload.ts`) kutadigan shakl. U kitob javobini `AdminPdfBook` deb
   * turlaydi; biz natijani ishlatmaymiz (so'rovlar qayta olinadi), shuning uchun tur o'tkaziladi.
   */
  asPdfUploadApi() {
    return {
      initPdfUpload: (id: string, file: { name: string; size: number; type: string }) =>
        this.initUpload(id, file),
      completePdfUpload: (id: string, parts: PdfUploadPart[]) =>
        this.completeUpload(id, parts) as unknown as Promise<AdminPdfBook>,
    };
  }
}

let instance: AdminLibraryApi | undefined;

export function getAdminLibraryApi(): AdminLibraryApi {
  instance ??= new AdminLibraryApi();
  return instance;
}
