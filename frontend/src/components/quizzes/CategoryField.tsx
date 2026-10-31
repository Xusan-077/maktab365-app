"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useCreateCategory } from "@/hooks/useQuizMutations";
import { useToast } from "@/hooks/useToast";
import { ApiError } from "@/lib/api/types";
import { quizQueries } from "@/lib/quizzes/queries";
import { QUIZ_LIMITS } from "@/lib/quizzes/types";

interface Props {
  value: string;
  onChange: (id: string) => void;
}

/** Kategoriya tanlash + yangisini shu yerning o'zida qo'shish (ustozga tegishli). */
export function CategoryField({ value, onChange }: Props) {
  const t = useTranslations("quizzes.form.category");
  const { toast } = useToast();
  const { data: categories = [] } = useQuery(quizQueries.categories());
  const create = useCreateCategory();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return setError(t("errors.required"));
    create.mutate(trimmed, {
      onSuccess: (category) => {
        onChange(category.id);
        setName("");
        setAdding(false);
        setError(null);
        toast({ variant: "success", title: t("added") });
      },
      onError: (e) => {
        const exists =
          e instanceof ApiError && JSON.stringify(e.details).includes("category_exists");
        setError(exists ? t("errors.exists") : t("errors.failed"));
      },
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Select
        label={t("label")}
        value={value}
        onChange={onChange}
        options={[
          { value: "", label: t("none") },
          ...categories.map((category) => ({ value: category.id, label: category.name })),
        ]}
      />
      {adding ? (
        <div className="flex flex-wrap items-start gap-2">
          <div className="min-w-48 flex-1">
            <Input
              value={name}
              maxLength={QUIZ_LIMITS.categoryName}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submit();
                }
              }}
              aria-label={t("nameLabel")}
              placeholder={t("namePlaceholder")}
              error={error}
              autoFocus
            />
          </div>
          <Button size="md" loading={create.isPending} onClick={submit}>
            {t("save")}
          </Button>
          <Button variant="ghost" onClick={() => setAdding(false)}>
            {t("cancel")}
          </Button>
        </div>
      ) : (
        <Button variant="ghost" size="sm" className="self-start" onClick={() => setAdding(true)}>
          <Plus className="size-4" aria-hidden />
          {t("add")}
        </Button>
      )}
    </div>
  );
}
