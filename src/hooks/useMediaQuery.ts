import { useSyncExternalStore } from "react";

/** CSS media query holati. Serverda va gidratsiyada `false`, keyin brauzer qiymati. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", notify);
      return () => list.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
