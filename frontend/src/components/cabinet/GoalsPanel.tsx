"use client";

import { yupResolver } from "@hookform/resolvers/yup";
import { Check, Target, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForm, type Resolver } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { useGoals } from "@/hooks/useGoals";
import { useToast } from "@/hooks/useToast";
import { cn } from "@/lib/utils/cn";
import { createGoalSchema, GOAL_TITLE_MAX, type GoalFormValues } from "@/lib/validation/goal";
import { EmptyText, Panel } from "./Panel";

/** Shaxsiy rejalar: qisqa ro'yxat, "bajarildi" belgisi va yangi reja qo'shish. */
export function GoalsPanel() {
  const t = useTranslations("library.goals");
  const { toast } = useToast();
  const { goals, isPending, isError, create, toggle, remove } = useGoals();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<GoalFormValues>({
    resolver: yupResolver(createGoalSchema()) as unknown as Resolver<GoalFormValues>,
    defaultValues: { title: "", dueDate: "" },
  });

  const failed = () => toast({ variant: "error", title: t("saveFailed") });

  const onSubmit = handleSubmit((values) => {
    create.mutate(
      { title: values.title.trim(), due_date: values.dueDate || null },
      { onError: failed },
    );
    reset();
  });

  return (
    <Panel title={t("title")}>
      {isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : isError ? (
        <EmptyText>{t("loadFailed")}</EmptyText>
      ) : goals.length === 0 ? (
        <EmptyState icon={Target}>{t("empty")}</EmptyState>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="goals-list">
          {goals.map((goal) => (
            <li
              key={goal.id}
              className="border-border flex items-center gap-3 rounded-lg border px-3 py-2"
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={goal.done}
                aria-label={t(goal.done ? "markOpen" : "markDone", { title: goal.title })}
                onClick={() =>
                  toggle.mutate({ id: goal.id, done: !goal.done }, { onError: failed })
                }
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border",
                  goal.done
                    ? "border-primary-600 bg-primary-600 text-white"
                    : "border-border hover:bg-subtle",
                )}
              >
                {goal.done && <Check className="size-4" aria-hidden />}
              </button>
              <div className="min-w-0 flex-1">
                <p className={cn("truncate font-medium", goal.done && "text-muted line-through")}>
                  {goal.title}
                </p>
                {goal.due_date && (
                  <p className="text-muted text-sm tabular-nums">
                    {t("due", { date: goal.due_date })}
                  </p>
                )}
              </div>
              <button
                type="button"
                aria-label={t("remove", { title: goal.title })}
                onClick={() => remove.mutate(goal.id, { onError: failed })}
                className="text-muted hover:text-foreground flex size-8 shrink-0 items-center justify-center rounded-md"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        noValidate
        onSubmit={onSubmit}
        className="flex flex-col gap-3 sm:flex-row sm:items-start"
      >
        <Input
          aria-label={t("titleLabel")}
          placeholder={t("titlePlaceholder")}
          maxLength={GOAL_TITLE_MAX}
          error={
            errors.title?.message
              ? t(`errors.${errors.title.message}` as "errors.required")
              : undefined
          }
          className="sm:min-w-56"
          {...register("title")}
        />
        <Input type="date" aria-label={t("dueLabel")} {...register("dueDate")} />
        <Button type="submit" variant="secondary">
          {t("add")}
        </Button>
      </form>
    </Panel>
  );
}
