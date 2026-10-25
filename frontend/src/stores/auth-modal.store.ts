import { create } from "zustand";

/** Nima uchun kirish so'raldi — oynadagi izoh shunga qarab tanlanadi. */
export type AuthModalReason = "default" | "save" | "note" | "result" | "resume";

interface AuthModalState {
  open: boolean;
  reason: AuthModalReason;
  /** Kirgandan keyin bajariladigan amal (masalan, qaydni saqlash). Onboarding kerak bo'lsa bajarilmaydi. */
  onSuccess: (() => void) | null;
  openModal: (options?: { reason?: AuthModalReason; onSuccess?: () => void }) => void;
  close: () => void;
}

/**
 * Yagona "Kirish" oynasi (`AuthModal`) holati. Tokenlar bu yerda emas — ular Auth.js'ning shifrlangan
 * httpOnly cookie'sida (brauzer JS'iga chiqmaydi).
 */
export const useAuthModalStore = create<AuthModalState>()((set) => ({
  open: false,
  reason: "default",
  onSuccess: null,
  openModal: ({ reason = "default", onSuccess } = {}) =>
    set({ open: true, reason, onSuccess: onSuccess ?? null }),
  close: () => set({ open: false, onSuccess: null }),
}));
