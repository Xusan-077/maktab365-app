import { useEffect, useState } from "react";

/**
 * IntersectionObserver bilan ko'rinib turgan bo'limlardan eng yuqoridagisini qaytaradi.
 * Hech biri ko'rinmasa (bo'limlar orasida) oxirgi faol bo'lim saqlanadi.
 */
export function useActiveSection(ids: readonly string[]): string | undefined {
  const [active, setActive] = useState<string | undefined>(ids[0]);

  useEffect(() => {
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        const first = ids.find((id) => visible.has(id));
        if (first) setActive(first);
      },
      // Yuqoridagi sticky header ostida va ekranning pastki qismida emas, yuqori ~40% da hisoblaymiz.
      { rootMargin: "-80px 0px -60% 0px" },
    );
    for (const id of ids) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [ids]);

  return active;
}
