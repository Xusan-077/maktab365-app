import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { PREFERENCES_STORAGE_KEY } from "@/lib/utils/preferences";
import type { TextSize, Theme } from "@/types/preferences";

interface PreferencesState {
  theme: Theme;
  textSize: TextSize;
  setTheme: (theme: Theme) => void;
  setTextSize: (textSize: TextSize) => void;
}

// skipHydration: SSR bilan mos kelishi uchun store PreferencesProvider ichida qo'lda rehydrate qilinadi.
export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: "system",
      textSize: "m",
      setTheme: (theme) => set({ theme }),
      setTextSize: (textSize) => set({ textSize }),
    }),
    {
      name: PREFERENCES_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ theme: state.theme, textSize: state.textSize }),
      skipHydration: true,
    },
  ),
);
