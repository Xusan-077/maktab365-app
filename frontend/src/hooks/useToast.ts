import { useToastStore } from "@/stores/toast.store";

export function useToast() {
  const push = useToastStore((state) => state.push);
  const dismiss = useToastStore((state) => state.dismiss);
  return { toast: push, dismiss };
}
