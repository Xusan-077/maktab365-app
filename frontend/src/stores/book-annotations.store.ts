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

/** Server bilan sinxronlash uchun: oxirgi o'zgargan bet va uning yangi ro'yxati. */
export interface AnnotationChange {
  seq: number;
  bookId: string;
  page: number;
  items: readonly Annotation[];
}

interface AnnotationsState {
  bookId: string | null;
  /** Kimning chizmalari: foydalanuvchi id'si yoki `"guest"` (kirganda betlar qayta yuklanadi). */
  owner: string | null;
  tool: AnnotationTool;
  selectedId: string | null;
  /** Yuklangan betlar: ro'yxat + undo/redo tarixi. Bet almashganda tarix saqlanadi. */
  pages: Record<number, PageHistory>;
  lastChange: AnnotationChange | null;

  attach: (bookId: string, owner?: string) => void;
  setTool: (tool: AnnotationTool) => void;
  select: (id: string | null) => void;
  /** Serverdan kelgan ro'yxat (tarixsiz, faqat bet hali yuklanmagan bo'lsa). */
  hydrate: (page: number, items: readonly Annotation[]) => void;
  /** Foydalanuvchi o'zgartirdi: tarixga qadam va serverga yuborish. */
  commit: (page: number, items: readonly Annotation[]) => void;
  undo: (page: number) => boolean;
  redo: (page: number) => boolean;
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
