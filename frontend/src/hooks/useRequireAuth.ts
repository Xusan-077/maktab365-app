import { useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModalStore, type AuthModalReason } from "@/stores/auth-modal.store";

/**
 * Mehmon rejimi: o'qish login'siz ishlaydi, kirish faqat saqlash kerak bo'lganda so'raladi.
 * `requireAuth(action, reason)` — kirgan bo'lsa amal darhol bajariladi (`true`), aks holda
 * "Kirish" oynasi ochiladi va amal kirgandan keyin bajariladi (`false`).
 * Sessiya hali aniqlanmagan (`loading`) bo'lsa hech narsa qilinmaydi.
 */
export function useRequireAuth() {
  const { status } = useAuth();
  const openModal = useAuthModalStore((state) => state.openModal);

  return useCallback(
    (action?: () => void, reason: AuthModalReason = "save") => {
      if (status === "authenticated") {
        action?.();
        return true;
      }
      if (status === "unauthenticated") openModal({ reason, onSuccess: action });
      return false;
    },
    [status, openModal],
  );
}
