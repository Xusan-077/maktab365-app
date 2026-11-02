// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { Annotation } from "@/lib/pdf/annotations";
import {
  PDF_ANNOTATIONS_GUEST_KEY,
  usePdfAnnotationsGuestStore,
} from "@/stores/pdf-annotations-guest.store";
import { usePdfAnnotations } from "./usePdfAnnotations";

const mark = (id: string, book = "b1", page = 2): Annotation => ({
  id,
  pdf_book_id: book,
  page,
  color: "yellow",
  rects: [{ x: 0.1, y: 0.1, w: 0.2, h: 0.05 }],
  note: "",
});

beforeEach(() => {
  window.localStorage.clear();
  usePdfAnnotationsGuestStore.setState({ items: [] });
});

describe("usePdfAnnotations (faqat qurilmada)", () => {
  it("saqlaydi, o'chiradi va qaytaradi — localStorage'da", () => {
    const { result } = renderHook(() => usePdfAnnotations("b1"));
    act(() => result.current.save(mark("a")));
    expect(result.current.items.map((item) => item.id)).toEqual(["a"]);
    expect(window.localStorage.getItem(PDF_ANNOTATIONS_GUEST_KEY)).toContain('"a"');

    let removed: Annotation | null = null;
    act(() => {
      removed = result.current.remove("a");
    });
    expect(removed).toMatchObject({ id: "a" });
    expect(result.current.items).toHaveLength(0);
    act(() => result.current.restore([removed!]));
    expect(result.current.items.map((item) => item.id)).toEqual(["a"]);
  });

  it("removeAll faqat shu kitobni tozalaydi", () => {
    usePdfAnnotationsGuestStore.setState({ items: [mark("a"), mark("b", "b2"), mark("c")] });
    const { result } = renderHook(() => usePdfAnnotations("b1"));
    let removed: Annotation[] = [];
    act(() => {
      removed = result.current.removeAll();
    });
    expect(removed.map((item) => item.id).sort()).toEqual(["a", "c"]);
    expect(usePdfAnnotationsGuestStore.getState().items.map((item) => item.id)).toEqual(["b"]);
  });
});
