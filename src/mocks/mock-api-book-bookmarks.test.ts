import { describe, expect, it } from "vitest";
import { MockApi } from "./mock-api";

const as = (id: string) => new MockApi({ session: () => ({ id, name: id }) });

describe("MockApi: saqlangan kitoblar", () => {
  it("kitobni saqlaydi va qayta bosilganda olib tashlaydi", async () => {
    const api = as("t1");
    const added = await api.toggleBookBookmark("algebra-9");
    expect(added).toMatchObject({ bookmarked: true, bookmark: { bookId: "algebra-9" } });
    expect(await api.getBookBookmarks()).toHaveLength(1);
    expect(await api.toggleBookBookmark("algebra-9")).toEqual({
      bookmarked: false,
      bookmark: null,
    });
    expect(await api.getBookBookmarks()).toEqual([]);
  });

  it("mavzu xatcho'plari bilan aralashmaydi", async () => {
    const api = as("t1");
    await api.toggleBookBookmark("algebra-9");
    await api.toggleBookmark("algebra-9-viyet-teoremasi");
    expect(await api.getBookBookmarks()).toHaveLength(1);
    expect(await api.getBookmarks()).toHaveLength(1);
  });

  it("mavjud bo'lmagan kitobda 404, sessiyasiz 401", async () => {
    await expect(as("t1").toggleBookBookmark("yoq")).rejects.toMatchObject({ status: 404 });
    await expect(new MockApi({ session: () => null }).getBookBookmarks()).rejects.toMatchObject({
      status: 401,
    });
  });
});
