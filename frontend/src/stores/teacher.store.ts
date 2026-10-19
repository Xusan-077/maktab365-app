import { create } from "zustand";

interface TeacherState {
  /** "Darsda ko'rsatish" rejimi: header/menyular yashirin, matn kattalashgan. */
  presenting: boolean;
  /** Mashq javoblarini hamma mashqda ko'rsatish (global). */
  showAnswers: boolean;
  /** Qidiruv va ro'yxatlar filtri; `null` — profildagi fan/sinflar. */
  subjects: string[] | null;
  grades: number[] | null;
  setPresenting: (presenting: boolean) => void;
  setShowAnswers: (showAnswers: boolean) => void;
  setSubjects: (subjects: string[] | null) => void;
  setGrades: (grades: number[] | null) => void;
}

// Sessiya davomida xotirada turadi (persist yo'q): taqdimot holati va filtrlar sahifalar o'rtasida saqlanadi.
export const useTeacherStore = create<TeacherState>()((set) => ({
  presenting: false,
  showAnswers: false,
  subjects: null,
  grades: null,
  setPresenting: (presenting) => set({ presenting }),
  setShowAnswers: (showAnswers) => set({ showAnswers }),
  setSubjects: (subjects) => set({ subjects }),
  setGrades: (grades) => set({ grades }),
}));
