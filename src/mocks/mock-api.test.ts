import { describe, expect, it } from "vitest";
import { bookmarkSchema, progressSchema, userSchema } from "@/lib/api/schemas";
import { ApiError } from "@/lib/api/types";
import { MockApi } from "./mock-api";

const signedIn = () => new MockApi({ session: () => ({ id: "user-1", name: "Aziza" }) });

describe("MockApi", () => {
  it("sinflar va kitoblarni filtrlaydi", async () => {
    const api = new MockApi();
    expect(await api.getGrades()).toHaveLength(11);
    const grade9 = await api.getBooks({ grade: 9 });
    expect(grade9.map((b) => b.id)).toEqual(
      expect.arrayContaining(["algebra-9", "geometry-9", "english-9"]),
    );
    expect(await api.getBooks({ grade: 9, subjectId: "algebra" })).toHaveLength(1);
    expect((await api.getBooks({ q: "geometriya" })).every((b) => b.subjectId === "geometry")).toBe(
      true,
    );
  });

  it("kitob qidiruvi mavzu nomi bo'yicha ham topadi", async () => {
    const api = new MockApi();
    const byTopic = await api.getBooks({ q: "viyet" });
    expect(byTopic.map((b) => b.id)).toEqual(["algebra-9"]);
    expect((await api.getBooks({ q: "viyet", grade: 8 })).length).toBe(0);
  });

  it("kitob va boblar; topilmasa 404", async () => {
    const api = new MockApi();
    expect((await api.getBook("algebra-9")).grade).toBe(9);
    expect(await api.getChapters("algebra-9")).toHaveLength(1);
    expect(await api.getChapters("math-5")).toEqual([]);
    await expect(api.getBook("yo'q")).rejects.toMatchObject({ status: 404 });
    await expect(api.getChapters("yo'q")).rejects.toBeInstanceOf(ApiError);
  });

  it("mavzu bloklari bilan qaytadi va nusxa beradi (mutatsiya ta'sir qilmaydi)", async () => {
    const api = new MockApi();
    const topic = await api.getTopic("algebra-9-viyet-teoremasi");
    expect(topic.blocks.length).toBeGreaterThan(5);
    topic.blocks.length = 0;
    expect((await api.getTopic("algebra-9-viyet-teoremasi")).blocks.length).toBeGreaterThan(5);
  });

  it("qidiruv lotin, kirill va ru/en bo'yicha topadi", async () => {
    const api = new MockApi();
    const ids = async (q: string) => (await api.searchTopics(q)).map((r) => r.topic.id);
    expect(await ids("viyet")).toContain("algebra-9-viyet-teoremasi");
    expect(await ids("виет")).toContain("algebra-9-viyet-teoremasi");
    expect(await ids("Vieta")).toContain("algebra-9-viyet-teoremasi");
    expect(await ids("pifagor")).toContain("geometry-9-pifagor-teoremasi");
    expect(await ids("")).toEqual([]);
    expect(await api.searchTopics("teorema", { bookId: "geometry-9" })).toHaveLength(1);
  });

  it("progress birlashtirib saqlanadi va filtrlanadi", async () => {
    const api = signedIn();
    const topicId = "algebra-9-viyet-teoremasi";
    await api.saveProgress({ topicId, readStatus: "started", lastBlockId: "rule-reduced" });
    const saved = await api.saveProgress({
      topicId,
      exerciseStatus: "in_progress",
      mistakes: ["exercise-sum"],
    });
    expect(() => progressSchema.validateSync(saved, { strict: true })).not.toThrow();
    expect(saved).toMatchObject({
      readStatus: "started",
      exerciseStatus: "in_progress",
      lastBlockId: "rule-reduced",
      mistakes: ["exercise-sum"],
    });
    expect(await api.getProgress({ topicId })).toHaveLength(1);
    expect(await api.getProgress({ bookId: "geometry-9" })).toHaveLength(0);
    await expect(api.saveProgress({ topicId: "yo'q" })).rejects.toMatchObject({ status: 404 });
  });

  it("toggleBookmark qo'shadi va olib tashlaydi", async () => {
    const api = signedIn();
    const on = await api.toggleBookmark("algebra-9-viyet-teoremasi");
    expect(on.bookmarked).toBe(true);
    expect(() => bookmarkSchema.validateSync(on.bookmark, { strict: true })).not.toThrow();
    expect(await api.getBookmarks()).toHaveLength(1);
    expect(await api.toggleBookmark("algebra-9-viyet-teoremasi")).toEqual({
      bookmarked: false,
      bookmark: null,
    });
    expect(await api.getBookmarks()).toHaveLength(0);
  });

  it("kirmagan foydalanuvchi akkaunt amallarida 401 oladi", async () => {
    const api = new MockApi();
    expect(await api.getMe()).toBeNull();
    await expect(api.getBookmarks()).rejects.toMatchObject({ status: 401 });
  });

  it("akkauntlar bir-biridan ajratilgan, rol almashtirish mumkin", async () => {
    const storage = new Map<string, string>();
    const as = (id: string) =>
      new MockApi({
        session: () => ({ id, name: id }),
        storage: {
          getItem: (k) => storage.get(k) ?? null,
          setItem: (k, v) => void storage.set(k, v),
        },
      });
    await as("a").toggleBookmark("algebra-9-viyet-teoremasi");
    expect(await as("b").getBookmarks()).toHaveLength(0);
    expect(await as("a").getBookmarks()).toHaveLength(1);
    await as("a").saveProfile({ role: "student", name: "A", grade: 9 });
    const teacher = await as("a").saveProfile({
      role: "teacher",
      name: "A",
      subjects: ["math"],
      grades: [9],
    });
    expect(teacher.role).toBe("teacher");
    expect(await as("a").getMe()).toEqual(teacher);
  });

  it("profilni yangilaydi va bo'sh ismni rad etadi", async () => {
    const api = signedIn();
    expect(await api.getMe()).toBeNull();
    await api.saveProfile({ role: "student", name: "Aziza", grade: 9 });
    const updated = await api.updateProfile({ name: "  Madina ", grade: 10 });
    expect(updated).toMatchObject({ role: "student", name: "Madina", grade: 10 });
    const me = await api.getMe();
    expect(() => userSchema.validateSync(me, { strict: true })).not.toThrow();
    await expect(api.updateProfile({ name: "  " })).rejects.toMatchObject({ status: 400 });
  });
});
