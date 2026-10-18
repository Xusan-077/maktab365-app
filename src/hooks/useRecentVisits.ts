import { useEffect } from "react";
import { useRecentStore, type RecentVisit } from "@/stores/recent.store";

/** Shu qurilmada yaqinda ochilgan mavzular (eng yangisi birinchi). */
export function useRecentVisits(): RecentVisit[] {
  const visits = useRecentStore((state) => state.visits);
  useEffect(() => {
    void useRecentStore.persist.rehydrate();
  }, []);
  return visits;
}
