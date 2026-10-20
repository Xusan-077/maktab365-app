import { describe, expect, it } from "vitest";
import { HttpApi } from "./http-api";
import { createHttpClient } from "./http-client";

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" }, ...init });

const text = (uz: string) => ({ uz });

const BOOK = {
  slug: "algebra-9",
  subject: "algebra",
  grade: 9,
  title: text("Algebra. 9-sinf"),
  author: text("Mualliflar jamoasi"),
  publisher: "",
  edition: text("3-nashr"),
  year: 2019,
  cover: null,
  pdf: "http://api.test/media/pdf/a.pdf",
  topics_ready: true,
  topics_count: 2,
};

const DETAIL = {
  ...BOOK,
  chapters: [
    {
      slug: "kvadrat",
      order: 2,
      title: text("Kvadrat tenglamalar"),
      topics: [
        { slug: "viyet", order: 1, title: text("Viyet"), summary: text("S"), unverified: true },
        { slug: "diskriminant", order: 2, title: text("D"), summary: text("S"), unverified: false },
      ],
    },
  ],
};

type Handler = (url: URL, request: Request) => Response | Promise<Response>;

function apiWith(handler: Handler) {
  const calls: string[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    calls.push(`${url.pathname}${url.search}`);
    return handler(url, request);
  }) as typeof fetch;
  return {
    api: new HttpApi(createHttpClient({ baseUrl: "http://api.test", fetch: fetchImpl })),
    calls,
  };
}

const page = (results: unknown[]) =>
  json({ count: results.length, next: null, previous: null, results });

describe("HttpApi katalog", () => {
  it("getSubjects: slug id bo'ladi", async () => {
    const { api } = apiWith(() =>
      json([{ slug: "geometriya", title: text("Geometriya"), icon: "", order: 3, books_count: 1 }]),
    );
    expect(await api.getSubjects()).toEqual([
      { id: "geometriya", slug: "geometriya", name: text("Geometriya") },
    ]);
  });

  it("getGrades: 1–11", async () => {
    const { api } = apiWith(() =>
      json(Array.from({ length: 11 }, (_, i) => ({ grade: i + 1, books_count: 0 }))),
    );
    expect(await api.getGrades()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("getBooks: filtrlarni yuboradi va sahifalarni yig'adi", async () => {
    const { api, calls } = apiWith((url) => {
      const current = Number(url.searchParams.get("page"));
      return json({
        count: 2,
        next: current === 1 ? "http://api.test/next" : null,
        previous: null,
        results: [{ ...BOOK, slug: `algebra-${current}`, cover: "http://api.test/media/c.png" }],
      });
    });
    const books = await api.getBooks({ grade: 9, subjectId: "algebra", q: " alg " });
    expect(books.map((b) => b.id)).toEqual(["algebra-1", "algebra-2"]);
    expect(books[0]).toMatchObject({
      subjectId: "algebra",
      publishedYear: 2019,
      topicsReady: true,
      coverUrl: "http://api.test/media/c.png",
    });
    expect(calls[0]).toBe("/api/v1/books/?grade=9&subject=algebra&q=alg&page=1&page_size=100");
    expect(calls).toHaveLength(2);
  });

  it("getBook va getChapters: id'lar kitob slug'idan yasaladi", async () => {
    const { api } = apiWith(() => json(DETAIL));
    expect(await api.getBook("algebra-9")).toMatchObject({
      id: "algebra-9",
      pdfUrl: "http://api.test/media/pdf/a.pdf",
    });
    const [chapter] = await api.getChapters("algebra-9");
    expect(chapter).toMatchObject({ id: "algebra-9-ch2", bookId: "algebra-9", order: 2 });
    expect(chapter.topics.map((topic) => [topic.id, topic.chapterId, topic.ready])).toEqual([
      ["algebra-9-viyet", "algebra-9-ch2", true],
      ["algebra-9-diskriminant", "algebra-9-ch2", true],
    ]);
  });

  it("getBook: 404 ApiError(not_found)", async () => {
    const { api } = apiWith(() =>
      json({ code: "not_found", message: "Kitob topilmadi." }, { status: 404 }),
    );
    await expect(api.getBook("yoq")).rejects.toMatchObject({ status: 404, code: "not_found" });
  });

  const TOPIC = {
    slug: "viyet-teoremasi",
    order: 1,
    title: text("Viyet"),
    summary: text("S"),
    unverified: true,
    book: "algebra-9-ext",
    chapter: "kvadrat",
    status: "draft",
    blocks: [{ id: "goal", type: "goal", text: text("Maqsad") }],
    previous: null,
    next: null,
    breadcrumb: {
      subject: { slug: "algebra", title: text("Algebra") },
      book: { slug: "algebra-9-ext", title: text("A"), grade: 9 },
      chapter: { slug: "kvadrat", order: 3, title: text("K") },
    },
  };

  it("getTopic: kitob slug'ini eng uzun mos prefiksdan aniqlaydi", async () => {
    const { api, calls } = apiWith((url) =>
      url.pathname === "/api/v1/books/"
        ? page([BOOK, { ...BOOK, slug: "algebra-9-ext" }])
        : json(TOPIC),
    );
    const topic = await api.getTopic("algebra-9-ext-viyet-teoremasi");
    expect(calls.at(-1)).toBe("/api/v1/books/algebra-9-ext/topics/viyet-teoremasi/");
    expect(topic).toMatchObject({
      id: "algebra-9-ext-viyet-teoremasi",
      bookId: "algebra-9-ext",
      chapterId: "algebra-9-ext-ch3",
      status: "draft",
    });
    expect(topic.blocks).toHaveLength(1);
  });

  it("getTopic: tekshirilgan (unverified=false) mavzu 'reviewed'", async () => {
    const { api } = apiWith((url) =>
      url.pathname === "/api/v1/books/"
        ? page([BOOK])
        : json({ ...TOPIC, book: "algebra-9", unverified: false, status: "published" }),
    );
    expect((await api.getTopic("algebra-9-viyet-teoremasi")).status).toBe("reviewed");
  });

  it("getTopic: kitobi yo'q id uchun 404", async () => {
    const { api } = apiWith(() => page([]));
    await expect(api.getTopic("yoq-mavzu")).rejects.toMatchObject({ status: 404 });
  });

  it("searchTopics: snippet va id'lar; bo'sh so'rov so'rovsiz bo'sh", async () => {
    const { api, calls } = apiWith(() =>
      json({
        count: 1,
        results: [
          {
            topic: {
              slug: "diskriminant",
              order: 3,
              title: text("Diskriminant"),
              summary: text("S"),
              unverified: true,
            },
            book: { slug: "algebra-9", title: text("Algebra"), grade: 9, subject: "algebra" },
            chapter_order: 1,
            chapter_title: text("Kvadrat"),
            snippet: "…⟦diskriminant⟧ni hisoblab…",
            rank: 0.4,
          },
        ],
      }),
    );
    expect(await api.searchTopics("   ")).toEqual([]);
    expect(calls).toHaveLength(0);
    const [hit] = await api.searchTopics("диск", { bookId: "algebra-9" });
    expect(calls[0]).toBe("/api/v1/search/?q=%D0%B4%D0%B8%D1%81%D0%BA&book=algebra-9");
    expect(hit).toMatchObject({
      topic: { id: "algebra-9-diskriminant", chapterId: "algebra-9-ch1", bookId: "algebra-9" },
      snippet: "…⟦diskriminant⟧ni hisoblab…",
    });
  });
});
