"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Chip } from "@/components/ui/Chip";
import { Input } from "@/components/ui/Input";
import type { QuizCategory } from "@/lib/quizzes/types";

interface Props {
  search: string;
  onSearchChange: (value: string) => void;
  categories: QuizCategory[];
  category: string;
  onCategoryChange: (id: string) => void;
}

export function QuizFilters({
  search,
  onSearchChange,
  categories,
  category,
  onCategoryChange,
}: Props) {
  const t = useTranslations("quizzes.list");
  return (
    <div className="flex flex-col gap-3">
      <div className="relative max-w-md">
        <Search
          className="text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          aria-label={t("searchLabel")}
          placeholder={t("searchPlaceholder")}
          className="pl-9"
        />
      </div>
      {categories.length > 0 && (
        <div role="group" aria-label={t("categoryFilter")} className="flex flex-wrap gap-2">
          <Chip selected={category === ""} onClick={() => onCategoryChange("")}>
            {t("allCategories")}
          </Chip>
          {categories.map((item) => (
            <Chip
              key={item.id}
              selected={category === item.id}
              onClick={() => onCategoryChange(item.id)}
            >
              {item.name}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}
