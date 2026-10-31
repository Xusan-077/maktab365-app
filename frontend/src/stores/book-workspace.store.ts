import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  clampPanelWidth,
  DEFAULT_WORKSPACE,
  pushRecentColor,
  sanitizeWorkspace,
  type WorkspacePrefs,
} from "@/lib/books/workspace";

export const BOOK_WORKSPACE_STORAGE_KEY = "maktab365-book-workspace";

interface WorkspaceState extends WorkspacePrefs {
  setNotesOpen: (open: boolean) => void;
  toggleNotes: () => void;
  setPanelWidth: (width: number, available?: number) => void;
  setPenColor: (color: string) => void;
  setPenWidth: (width: number) => void;
  setHighlightColor: (color: string) => void;
  setTextColor: (color: string) => void;
  setTextSize: (size: number) => void;
}

/** Ish maydoni sozlamalari (qurilma bo'yicha): yon daftar holati/kengligi, asbob rangi va qalinligi, oxirgi ranglar. */
export const useBookWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      ...DEFAULT_WORKSPACE,
      setNotesOpen: (notesOpen) => set({ notesOpen }),
      toggleNotes: () => set((state) => ({ notesOpen: !state.notesOpen })),
      setPanelWidth: (width, available) => set({ panelWidth: clampPanelWidth(width, available) }),
      setPenColor: (penColor) =>
        set((state) => ({
          penColor,
          recentColors: pushRecentColor(state.recentColors, penColor),
        })),
      setPenWidth: (penWidth) => set({ penWidth }),
      setHighlightColor: (highlightColor) =>
        set((state) => ({
          highlightColor,
          recentColors: pushRecentColor(state.recentColors, highlightColor),
        })),
      setTextColor: (textColor) =>
        set((state) => ({
          textColor,
          recentColors: pushRecentColor(state.recentColors, textColor),
        })),
      setTextSize: (textSize) => set({ textSize }),
    }),
    {
      name: BOOK_WORKSPACE_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        notesOpen: state.notesOpen,
        panelWidth: state.panelWidth,
        penColor: state.penColor,
        penWidth: state.penWidth,
        highlightColor: state.highlightColor,
        textColor: state.textColor,
        textSize: state.textSize,
        recentColors: state.recentColors,
      }),
      merge: (persisted, current) => ({ ...current, ...sanitizeWorkspace(persisted) }),
      skipHydration: true,
    },
  ),
);
