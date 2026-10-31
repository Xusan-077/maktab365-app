import { createHttpClient, unwrap, type HttpClient } from "@/lib/api/http-client";
import type { components } from "@/lib/api/schema";
import type { AnnotationItem } from "./annotations";

type Schemas = components["schemas"];

export type Book = Schemas["Book"];
export type BookDetail = Schemas["BookDetail"];
export type BookPage = Schemas["BookPage"];
export type BookChapter = Schemas["BookChapter"];
export type BookSearchHit = Schemas["BookSearchHit"];
export type BookPageText = Schemas["BookPageText"];
export type BookProgress = Schemas["BookProgress"];
export type Bookmark = Schemas["Bookmark"];
export type PageNote = Schemas["PageNote"];
export type ServerAnnotation = Schemas["PageAnnotation"];
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

/** Ochiq kitoblar API'si (katalog, tafsilot, sahifa rasmlari). */
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

  /** Kitobning hamma sahifalari (tartib bilan): rasm, eskiz, o'lcham. */
  async pages(id: string): Promise<BookPage[]> {
    return unwrap(await this.client.GET("/api/v1/books/{id}/pages/", { params: { path: { id } } }));
  }

  /** Sahifa matni (badiiy kitobning matnli o'qish rejimi). */
  async pageText(id: string, number: number): Promise<BookPageText> {
    const result = await this.client.GET("/api/v1/books/{id}/pages/{number}/text/", {
      params: { path: { id, number } },
    });
    return unwrap(result);
  }

  /** Kitob ichida qidirish (kamida 2 belgi): moslik topilgan betlar va parchalar. */
  async search(id: string, q: string): Promise<BookSearchHit[]> {
    const result = await this.client.GET("/api/v1/books/{id}/search/", {
      params: { path: { id }, query: { q } },
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
