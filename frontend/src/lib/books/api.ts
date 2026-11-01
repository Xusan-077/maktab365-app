import { createHttpClient, unwrap, type HttpClient } from "@/lib/api/http-client";
import type { components } from "@/lib/api/schema";
import type { AnnotationItem } from "./annotations";

type Schemas = components["schemas"];

export type Book = Schemas["Book"];
export type BookDetail = Schemas["BookDetail"];
export type BookFileUrl = Schemas["PdfFileUrl"];
export type BookChapter = Schemas["BookChapter"];
export type BookProgress = Schemas["BookProgress"];
export type Bookmark = Schemas["Bookmark"];
export type PageNote = Schemas["PageNote"];
export type ServerAnnotation = Schemas["PageAnnotation"];
export type PageEntry = Schemas["PageEntry"];
export type PageEntryList = Schemas["PageEntryList"];
export type EntryBookCount = Schemas["EntryBookCount"];
export type PageEntryType = "note" | "highlight" | "drawing" | "text" | "bookmark";
export type BookType = Schemas["BookTypeEnum"];
export type BookLanguage = Schemas["LanguageEnum"];

export const BOOKS_PAGE_SIZE = 24;

export interface BookFilters {
  type?: BookType;
  grade?: number;
  language?: BookLanguage;
  q?: string;
  ordering?: "title";
  page?: number;
  pageSize?: number;
}

export interface BooksPage {
  count: number;
  results: Book[];
}

/** Ochiq kitoblar API'si (katalog, tafsilot, PDF o'qish URL'i). */
export class BooksApi {
  constructor(private readonly client: HttpClient = createHttpClient()) {}

  async list(filters: BookFilters = {}): Promise<BooksPage> {
    const result = await this.client.GET("/api/v1/books/", {
      params: {
        query: {
          type: filters.type,
          grade: filters.grade,
          language: filters.language,
          q: filters.q || undefined,
          ordering: filters.ordering,
          page: filters.page,
          page_size: filters.pageSize ?? BOOKS_PAGE_SIZE,
        },
      },
    });
    return unwrap(result);
  }

  async book(id: string): Promise<BookDetail> {
    return unwrap(await this.client.GET("/api/v1/books/{id}/", { params: { path: { id } } }));
  }

  /** PDF'ning qisqa muddatli o'qish URL'i (har ochilishda yangi; HTTP Range ishlaydi). */
  async fileUrl(id: string): Promise<BookFileUrl> {
    const result = await this.client.GET("/api/v1/books/{id}/file-url/", {
      params: { path: { id } },
    });
    return unwrap(result);
  }
}

/** Kirgan o'quvchining kitoblardagi holati: oxirgi bet va xatcho'plar (faqat brauzerda, BFF orqali). */
export class MyBooksApi {
  constructor(private readonly client: HttpClient = createHttpClient()) {}

  async progressList(): Promise<BookProgress[]> {
    return unwrap(await this.client.GET("/api/v1/me/books/progress/"));
  }

  /** Yozuv yo'q bo'lsa `null` (404 xato emas, "hali o'qilmagan"). */
  async progress(id: string): Promise<BookProgress | null> {
    const result = await this.client.GET("/api/v1/me/books/{id}/progress/", {
      params: { path: { id } },
    });
    if (result.response.status === 404) return null;
    return unwrap(result);
  }

  async saveProgress(id: string, lastPage: number, updatedAt: string): Promise<BookProgress> {
    const result = await this.client.PUT("/api/v1/me/books/{id}/progress/", {
      params: { path: { id } },
      body: { last_page: lastPage, updated_at: updatedAt },
    });
    return unwrap(result);
  }

  async bookmarks(id: string): Promise<Bookmark[]> {
    const result = await this.client.GET("/api/v1/me/books/{id}/bookmarks/", {
      params: { path: { id } },
    });
    return unwrap(result);
  }

  async addBookmark(id: string, page: number): Promise<Bookmark> {
    const result = await this.client.POST("/api/v1/me/books/{id}/bookmarks/", {
      params: { path: { id } },
      body: { page },
    });
    return unwrap(result);
  }

  /** Betning yon daftar yozuvi (yozilmagan bo'lsa bo'sh matn). */
  async note(id: string, page: number): Promise<PageNote> {
    const result = await this.client.GET("/api/v1/me/books/{id}/pages/{number}/notes/", {
      params: { path: { id, number: page } },
    });
    return unwrap(result);
  }

  async saveNote(id: string, page: number, text: string): Promise<PageNote> {
    const result = await this.client.PUT("/api/v1/me/books/{id}/pages/{number}/notes/", {
      params: { path: { id, number: page } },
      body: { text },
    });
    return unwrap(result);
  }

  /** Bir nechta betning annotatsiyalari bitta so'rovda (ko'pi bilan 10 bet). */
  async annotations(id: string, pages: readonly number[]): Promise<ServerAnnotation[]> {
    const result = await this.client.GET("/api/v1/me/books/{id}/annotations/", {
      params: { path: { id }, query: { pages: pages.join(",") } },
    });
    return unwrap(result);
  }

  /** Betning barcha annotatsiyasini almashtiradi (idempotent: mijoz id'lari saqlanadi). */
  async savePageAnnotations(
    id: string,
    page: number,
    items: readonly AnnotationItem[],
  ): Promise<ServerAnnotation[]> {
    const result = await this.client.PUT("/api/v1/me/books/{id}/pages/{number}/annotations/", {
      params: { path: { id, number: page } },
      body: { annotations: [...items] },
    });
    return unwrap(result);
  }

  /** Mening yozuvlarim: bet bo'yicha jamlangan, filtr va sahifalash bilan. */
  async entries(query: {
    book?: string;
    type?: PageEntryType;
    color?: string;
    q?: string;
    page?: number;
    page_size?: number;
  }): Promise<PageEntryList> {
    const result = await this.client.GET("/api/v1/me/annotations/", { params: { query } });
    return unwrap(result);
  }

  async entryBooks(): Promise<EntryBookCount[]> {
    return unwrap(await this.client.GET("/api/v1/me/annotations/books/"));
  }

  async updateAnnotation(id: string, annotationId: string, data: unknown): Promise<void> {
    const result = await this.client.PATCH("/api/v1/me/books/{id}/annotations/{annotation_id}/", {
      params: { path: { id, annotation_id: annotationId } },
      body: { data },
    });
    unwrap(result);
  }

  async deleteAnnotation(id: string, annotationId: string): Promise<void> {
    const result: { error?: unknown; response: Response } = await this.client.DELETE(
      "/api/v1/me/books/{id}/annotations/{annotation_id}/",
      { params: { path: { id, annotation_id: annotationId } } },
    );
    if (result.error !== undefined) unwrap({ error: result.error, response: result.response });
  }

  async removeBookmark(id: string, page: number): Promise<void> {
    const result: { error?: unknown; response: Response } = await this.client.DELETE(
      "/api/v1/me/books/{id}/bookmarks/{page}/",
      { params: { path: { id, page } } },
    );
    if (result.error !== undefined) unwrap({ error: result.error, response: result.response });
  }
}

let myInstance: MyBooksApi | undefined;

export function getMyBooksApi(): MyBooksApi {
  myInstance ??= new MyBooksApi();
  return myInstance;
}

let instance: BooksApi | undefined;

export function getBooksApi(): BooksApi {
  instance ??= new BooksApi();
  return instance;
}
