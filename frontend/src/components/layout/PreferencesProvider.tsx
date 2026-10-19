"use client";

import { useEffect, useState } from "react";
import { applyPreferences } from "@/lib/utils/preferences";
import { usePreferencesStore } from "@/stores/preferences.store";

/**
 * Saqlangan sozlamalarni store'ga yuklaydi va <html> atributlarini sinxron ushlaydi.
 * Birinchi paint'dagi atributlarni inline skript qo'yadi (flash yo'q).
 */
export function PreferencesProvider() {
  const theme = usePreferencesStore((state) => state.theme);
  const textSize = usePreferencesStore((state) => state.textSize);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.resolve(usePreferencesStore.persist.rehydrate()).then(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    applyPreferences(theme, textSize);
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyPreferences(theme, textSize);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [ready, theme, textSize]);

  return null;
}
