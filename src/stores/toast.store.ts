import { create } from "zustand";

export type ToastVariant = "info" | "success" | "error";

export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
}

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, "id" | "variant"> & { variant?: ToastVariant }) => string;
  dismiss: (id: string) => void;
}

let seq = 0;

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  push: (toast) => {
    const id = String(++seq);
    set((state) => ({ toasts: [...state.toasts, { variant: "info", ...toast, id }] }));
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
