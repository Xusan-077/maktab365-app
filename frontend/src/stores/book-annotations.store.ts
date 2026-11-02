import { create } from "zustand";
import {
  canRedo,
  canUndo,
  commitHistory,
  createHistory,
  redoHistory,
  undoHistory,
  type PageHistory,
} from "@/lib/books/annotation-history";
import type { Annotation, AnnotationTool } from "@/lib/books/annotations";

/** Saqlash uchun (qurilmaga): oxirgi o'zgargan bet va uning yangi ro'yxati. */
export interface AnnotationChange {
  seq: number;
  bookId: string;
  page: number;
  items: readonly Annotation[];
}

interface AnnotationsState {
  bookId: string | null;
  /** Kimning chizmalari (hozir doim qurilma — `"local"`); almashsa betlar qayta yuklanadi. */
  owner: string | null;
  tool: AnnotationTool;
  selectedId: string | null;
  /** Yuklangan betlar: ro'yxat + undo/redo tarixi. Bet almashganda tarix saqlanadi. */
  pages: Record<number, PageHistory>;
  lastChange: AnnotationChange | null;

  attach: (bookId: string, owner?: string) => void;
  setTool: (tool: AnnotationTool) => void;
  select: (id: string | null) => void;
  /** Qurilmadan o'qilgan ro'yxat (tarixsiz, faqat bet hali yuklanmagan bo'lsa). */
  hydrate: (page: number, items: readonly Annotation[]) => void;
  /** Foydalanuvchi o'zgartirdi: tarixga qadam va qurilmaga yozish. */
  commit: (page: number, items: readonly Annotation[]) => void;
  undo: (page: number) => boolean;
  redo: (page: number) => boolean;
  /**
   * Kitobdagi barcha chizmalarni o'chiradi (tasdiqlangandan keyin; tarix ham tozalanadi).
   * `lastChange` yozilmaydi — qurilmadagi nusxani chaqiruvchi o'zi o'chiradi.
   */
  clearAll: () => void;
}

const EMPTY: readonly Annotation[] = [];

export const useBookAnnotationsStore = create<AnnotationsState>()((set, get) => {
  const record = (page: number, history: PageHistory, bookId: string) =>
    set((state) => ({
      pages: { ...state.pages, [page]: history },
      lastChange: {
        seq: (state.lastChange?.seq ?? 0) + 1,
        bookId,
        page,
        items: history.items,
      },
    }));

  return {
    bookId: null,
    owner: null,
    tool: "none",
    selectedId: null,
    pages: {},
    lastChange: null,

    attach: (bookId, owner) => {
      const state = get();
      if (state.bookId === bookId && state.owner === (owner ?? null)) return;
      // Kitob almashsa asbob o'chadi; faqat egasi (mehmon → akkaunt) almashsa asbob saqlanadi.
      const tool = state.bookId === bookId ? state.tool : "none";
      set({ bookId, owner: owner ?? null, tool, selectedId: null, pages: {}, lastChange: null });
    },
    setTool: (tool) => set({ tool, selectedId: null }),
    select: (selectedId) => set({ selectedId }),
    hydrate: (page, items) =>
      set((state) =>
        state.pages[page] ? state : { pages: { ...state.pages, [page]: createHistory(items) } },
      ),
    commit: (page, items) => {
      const { bookId, pages } = get();
      if (bookId === null) return;
      const history = commitHistory(pages[page] ?? createHistory(), items);
      if (history === pages[page]) return;
      record(page, history, bookId);
    },
    undo: (page) => {
      const { bookId, pages } = get();
      const current = pages[page];
      if (bookId === null || !current || !canUndo(current)) return false;
      set({ selectedId: null });
      record(page, undoHistory(current), bookId);
      return true;
    },
    redo: (page) => {
      const { bookId, pages } = get();
      const current = pages[page];
      if (bookId === null || !current || !canRedo(current)) return false;
      set({ selectedId: null });
      record(page, redoHistory(current), bookId);
      return true;
    },
    clearAll: () => {
      const pages: Record<number, PageHistory> = {};
      for (const page of Object.keys(get().pages)) pages[Number(page)] = createHistory();
      set({ pages, selectedId: null });
    },
  };
});

export const selectPageItems =
  (page: number) =>
  (state: AnnotationsState): readonly Annotation[] =>
    state.pages[page]?.items ?? EMPTY;
export const selectCanUndo = (page: number) => (state: AnnotationsState) => {
  const history = state.pages[page];
  return history ? canUndo(history) : false;
};
export const selectCanRedo = (page: number) => (state: AnnotationsState) => {
  const history = state.pages[page];
  return history ? canRedo(history) : false;
};
/** Kitobda (yuklangan betlarda) kamida bitta chizma bor. */
export const selectHasDrawings = (state: AnnotationsState): boolean =>
  Object.values(state.pages).some((history) => history.items.length > 0);
