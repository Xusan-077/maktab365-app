import { createHttpClient, unwrap, type HttpClient } from "@/lib/api/http-client";
import type { components } from "@/lib/api/schema";

type Schemas = components["schemas"];

export type Book = Schemas["Book"];
export type BookDetail = Schemas["BookDetail"];
export type BookPage = Schemas["BookPage"];
export type BookChapter = Schemas["BookChapter"];
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
}

let instance: BooksApi | undefined;

export function getBooksApi(): BooksApi {
  instance ??= new BooksApi();
  return instance;
}
