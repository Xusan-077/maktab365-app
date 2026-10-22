import { beforeEach, describe, expect, it } from "vitest";
import { usePdfGuestStore } from "./pdf-guest.store";

beforeEach(() => usePdfGuestStore.setState({ positions: {}, bookmarks: [] }));

describe("pdf-guest.store", () => {
  it("oxirgi sahifani vaqti bilan yozadi", () => {
    usePdfGuestStore.getState().record("b1", 7, new Date("2026-01-02T10:00:00Z"));

    expect(usePdfGuestStore.getState().positions.b1).toEqual({
      page: 7,
      updatedAt: "2026-01-02T10:00:00.000Z",
    });
  });

  it("xatcho'pni qo'shadi, takrorlamaydi va olib tashlaydi", () => {
    const { setBookmark } = usePdfGuestStore.getState();

    setBookmark("b1", true);
    setBookmark("b1", true);
    setBookmark("b2", true);
    expect(usePdfGuestStore.getState().bookmarks).toEqual(["b1", "b2"]);

    setBookmark("b1", false);
    expect(usePdfGuestStore.getState().bookmarks).toEqual(["b2"]);
  });

  it("clear sahifalar va xatcho'plarni tozalaydi", () => {
    usePdfGuestStore.getState().record("b1", 2);
    usePdfGuestStore.getState().setBookmark("b1", true);

    usePdfGuestStore.getState().clear();

    expect(usePdfGuestStore.getState()).toMatchObject({ positions: {}, bookmarks: [] });
  });
});
