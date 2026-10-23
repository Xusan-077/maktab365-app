import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { sanitizeAnnotations, upsertAnnotation, type Annotation } from "@/lib/pdf/annotations";

export const PDF_ANNOTATIONS_GUEST_KEY = "maktab365-guest-pdf-annotations";

interface GuestAnnotationsState {
  items: Annotation[];
  save: (annotation: Annotation) => void;
  remove: (id: string) => void;
  clear: () => void;
}

/** Mehmonning belgilari (faqat shu brauzerda); kirgandan keyin `merge-guest-data/` bilan qo'shiladi. */
export const usePdfAnnotationsGuestStore = create<GuestAnnotationsState>()(
  persist(
    (set) => ({
      items: [],
      save: (annotation) => set((state) => ({ items: upsertAnnotation(state.items, annotation) })),
      remove: (id) => set((state) => ({ items: state.items.filter((item) => item.id !== id) })),
      clear: () => set({ items: [] }),
    }),
    {
      name: PDF_ANNOTATIONS_GUEST_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
      merge: (persisted, current) => ({
        ...current,
        items: sanitizeAnnotations((persisted as { items?: unknown } | undefined)?.items),
      }),
      skipHydration: true,
    },
  ),
);
