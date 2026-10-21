import { describe, expect, it, vi } from "vitest";
import { HttpApi } from "./http-api";
import { createHttpClient } from "./http-client";
import { ApiError } from "./types";

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

const TOPIC = "algebra-9-viyet";

const progressDto = (patch: Record<string, unknown> = {}) => ({
  topic_id: TOPIC,
  book_id: "algebra-9",
  read_status: "read",
  exercise_status: "in_progress",
  last_block_id: "rule",
  scroll_position: null,
  mistakes: [{ exercise_id: "e1", attempts: 2, last_wrong_at: "2026-01-01T00:00:00Z" }],
  exercise_stats: { solved: ["e2"], attempts: { e1: 2, e2: 1 } },
  first_opened_at: "2026-01-01T00:00:00Z",
  read_at: "2026-01-01T00:00:00Z",
  passed_at: null,
  updated_at: "2026-01-02T00:00:00Z",
  ...patch,
});

function setup(respond: (request: Request) => Response | Promise<Response>) {
  const calls: Array<{ method: string; url: string; body: unknown }> = [];
  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const text = await request.clone().text();
    calls.push({
      method: request.method,
      url: new URL(request.url).pathname + new URL(request.url).search,
      body: text ? JSON.parse(text) : undefined,
    });
    return respond(request);
  };
  const api = new HttpApi(
    createHttpClient({ baseUrl: "http://api.test", fetch: fetchImpl as typeof fetch }),
  );
  return { api, calls };
}

describe("HttpApi: progress", () => {
  it("getProgress backend holatlarini frontend holatlariga aylantiradi", async () => {
    const { api, calls } = setup(() => json([progressDto()]));
    const [item] = await api.getProgress({ bookId: "algebra-9" });
    expect(calls[0].url).toBe("/api/v1/me/progress/?book=algebra-9");
    expect(item).toMatchObject({
      topicId: TOPIC,
      readStatus: "completed",
      exerciseStatus: "in_progress",
      lastBlockId: "rule",
      mistakes: ["e1"],
      solved: ["e2"],
      attempts: { e1: 2, e2: 1 },
      updatedAt: "2026-01-02T00:00:00Z",
    });
  });

  it("saveProgress PUT: holat nomlari, xatolar va hodisa vaqti yuboriladi", async () => {
    const { api, calls } = setup(() => json(progressDto({ exercise_status: "passed" })));
    const saved = await api.saveProgress({
      topicId: TOPIC,
      readStatus: "completed",
      exerciseStatus: "completed",
      lastBlockId: "rule",
      mistakes: ["e1"],
      solved: ["e2"],
      attempts: { e1: 3, e2: 1 },
      updatedAt: "2026-01-03T00:00:00.000Z",
    });
    expect(calls[0].method).toBe("PUT");
    expect(calls[0].url).toBe(`/api/v1/me/progress/${TOPIC}/`);
    expect(calls[0].body).toEqual({
      read_status: "read",
      exercise_status: "passed",
      last_block_id: "rule",
      mistakes: [{ exercise_id: "e1", attempts: 3, last_wrong_at: "2026-01-03T00:00:00.000Z" }],
      exercise_stats: { solved: ["e2"], attempts: { e1: 3, e2: 1 } },
      updated_at: "2026-01-03T00:00:00.000Z",
    });
    expect(saved.exerciseStatus).toBe("completed");
  });

  it("saveProgress faqat berilgan maydonlarni yuboradi", async () => {
    const { api, calls } = setup(() => json(progressDto()));
    await api.saveProgress({ topicId: TOPIC, readStatus: "started" });
    expect(calls[0].body).toEqual({ read_status: "in_progress" });
  });

  it("saveProgress 4xx da ApiError tashlaydi (navbat doimiy xato deb biladi)", async () => {
    const { api } = setup(() => json({ code: "not_found", message: "x" }, { status: 404 }));
    await expect(api.saveProgress({ topicId: "yoq" })).rejects.toMatchObject({
      status: 404,
      code: "not_found",
    });
    await expect(api.saveProgress({ topicId: "yoq" })).rejects.toBeInstanceOf(ApiError);
  });

  it("recordTopicOpened events/ ga topic_opened yuboradi", async () => {
    const { api, calls } = setup(() => json(progressDto()));
    await api.recordTopicOpened(TOPIC);
    expect(calls[0]).toMatchObject({
      method: "POST",
      url: "/api/v1/me/events/",
      body: { type: "topic_opened", topic_id: TOPIC },
    });
  });
});

describe("HttpApi: xatcho'p", () => {
  const bookmark = {
    id: "11111111-1111-1111-1111-111111111111",
    kind: "topic",
    topic_id: TOPIC,
    book_id: null,
    created_at: "2026-01-01T00:00:00Z",
  };

  it("setBookmark(true) POST, setBookmark(false) DELETE", async () => {
    const { api, calls } = setup((request) =>
      request.method === "DELETE" ? new Response(null, { status: 204 }) : json(bookmark),
    );
    expect(await api.setBookmark(TOPIC, true)).toMatchObject({
      bookmarked: true,
      bookmark: { topicId: TOPIC },
    });
    expect(await api.setBookmark(TOPIC, false)).toEqual({ bookmarked: false, bookmark: null });
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      "POST /api/v1/me/bookmarks/",
      `DELETE /api/v1/me/bookmarks/?kind=topic&topic_id=${TOPIC}`,
    ]);
  });

  it("toggleBookmark: 201 — qo'yildi; 200 (allaqachon bor) — olib tashlanadi", async () => {
    const { api, calls } = setup((request) =>
      request.method === "DELETE"
        ? new Response(null, { status: 204 })
        : json(bookmark, { status: 200 }),
    );
    expect(await api.toggleBookmark(TOPIC)).toEqual({ bookmarked: false, bookmark: null });
    expect(calls.at(-1)?.method).toBe("DELETE");

    const created = setup(() => json(bookmark, { status: 201 }));
    expect((await created.api.toggleBookmark(TOPIC)).bookmarked).toBe(true);
  });

  it("getBookmarks faqat mavzu xatcho'plarini so'raydi", async () => {
    const { api, calls } = setup(() => json([bookmark]));
    expect(await api.getBookmarks()).toMatchObject([{ topicId: TOPIC }]);
    expect(calls[0].url).toBe("/api/v1/me/bookmarks/?kind=topic");
  });

  it("kitob xatcho'pi", async () => {
    const book = { ...bookmark, kind: "book", topic_id: null, book_id: "algebra-9" };
    const { api, calls } = setup(() => json([book]));
    expect(await api.getBookBookmarks()).toMatchObject([{ bookId: "algebra-9" }]);
    expect(calls[0].url).toBe("/api/v1/me/bookmarks/?kind=book");
  });
});

describe("HttpApi: reja, dashboard, merge", () => {
  it("maqsadlar: yaratish va PATCH", async () => {
    const dto = {
      id: "22222222-2222-2222-2222-222222222222",
      title: "Takrorlash",
      topic_id: null,
      due_date: null,
      done: true,
      done_at: "2026-01-01T00:00:00Z",
      created_at: "2026-01-01T00:00:00Z",
    };
    const { api, calls } = setup(() => json(dto));
    expect(await api.createGoal("  Takrorlash ")).toMatchObject({
      title: "Takrorlash",
      done: true,
    });
    await api.updateGoal(dto.id, { done: true });
    expect(calls[0].body).toEqual({ title: "Takrorlash" });
    expect(calls[1]).toMatchObject({
      method: "PATCH",
      url: `/api/v1/me/goals/${dto.id}/`,
      body: { done: true },
    });
  });

  it("getDashboard va getResults frontend modeliga aylanadi", async () => {
    const dashboard = {
      continue: progressDto(),
      has_progress: true,
      subjects: [
        {
          book_id: "algebra-9",
          subject_id: "algebra",
          grade: 9,
          topics_total: 5,
          topics_read: 2,
          topics_passed: 1,
        },
      ],
      review: { count: 1, items: [progressDto()] },
      weekly: {
        since: "2026-01-01T00:00:00Z",
        finished: 1,
        read: 2,
        exercises_passed: 1,
        mistakes: 3,
        active: 2,
      },
      saved_count: 4,
    };
    const results = {
      counts: { mastered: 1, review: 1, in_progress: 0 },
      mastered: [progressDto({ exercise_status: "passed", mistakes: [] })],
      review: [progressDto()],
      in_progress: [],
    };
    const { api } = setup((request) =>
      json(new URL(request.url).pathname.endsWith("dashboard/") ? dashboard : results),
    );
    const view = await api.getDashboard();
    expect(view.continue?.lastBlockId).toBe("rule");
    expect(view.hasProgress).toBe(true);
    expect(view.subjects[0]).toEqual({
      bookId: "algebra-9",
      subjectId: "algebra",
      grade: 9,
      topicsTotal: 5,
      topicsRead: 2,
      topicsPassed: 1,
    });
    expect(view.review.items[0].mistakes).toEqual(["e1"]);
    expect(view.weekly.exercisesPassed).toBe(1);
    expect(view.savedCount).toBe(4);

    const grouped = await api.getResults();
    expect(grouped.counts).toEqual({ mastered: 1, review: 1, inProgress: 0 });
    expect(grouped.mastered[0].exerciseStatus).toBe("completed");
  });

  it("mergeGuestData mehmon ma'lumotini serverga mos shaklda yuboradi", async () => {
    const { api, calls } = setup(() => json({ progress: 1, bookmarks: 1, failed: ["yoq"] }));
    const result = await api.mergeGuestData({
      progress: {
        [TOPIC]: {
          readStatus: "started",
          lastBlockId: "rule",
          mistakes: ["e1"],
          attempts: { e1: 1 },
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      },
      bookmarks: [TOPIC],
    });
    expect(result).toEqual({ progress: 1, bookmarks: 1, failed: ["yoq"] });
    expect(calls[0].url).toBe("/api/v1/me/merge-guest-data/");
    expect(calls[0].body).toEqual({
      progress: [
        {
          topic_id: TOPIC,
          read_status: "in_progress",
          last_block_id: "rule",
          mistakes: [{ exercise_id: "e1", attempts: 1, last_wrong_at: "2026-01-01T00:00:00.000Z" }],
          exercise_stats: { attempts: { e1: 1 } },
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      bookmarks: [{ kind: "topic", topic_id: TOPIC }],
    });
  });

  it("teacher dashboard", async () => {
    const { api } = setup(() =>
      json({
        recent: [{ topic_id: TOPIC, book_id: "algebra-9", viewed_at: "2026-01-01T00:00:00Z" }],
        saved_topics: [],
        saved_books: [],
        saved_topics_count: 0,
        saved_books_count: 0,
      }),
    );
    const view = await api.getTeacherDashboard();
    expect(view.recent).toEqual([
      { topicId: TOPIC, bookId: "algebra-9", viewedAt: "2026-01-01T00:00:00Z" },
    ]);
  });
});

describe("HttpApi: tarmoq", () => {
  it("oflayn bo'lsa ApiError(network_error)", async () => {
    const api = new HttpApi(
      createHttpClient({
        baseUrl: "http://api.test",
        fetch: vi.fn().mockRejectedValue(new TypeError("fail")) as unknown as typeof fetch,
      }),
    );
    await expect(api.saveProgress({ topicId: TOPIC, readStatus: "started" })).rejects.toMatchObject(
      { code: "network_error" },
    );
  });
});
