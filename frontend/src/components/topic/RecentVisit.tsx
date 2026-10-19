"use client";

import { useEffect } from "react";
import { useRecentStore } from "@/stores/recent.store";

/** Mavzu ochilganini "yaqinda ochilganlar" ro'yxatiga yozadi (ko'rinmaydi). */
export function RecentVisit({ topicId }: { topicId: string }) {
  useEffect(() => {
    let active = true;
    Promise.resolve(useRecentStore.persist.rehydrate()).then(() => {
      if (active) useRecentStore.getState().visit(topicId);
    });
    return () => {
      active = false;
    };
  }, [topicId]);
  return null;
}
