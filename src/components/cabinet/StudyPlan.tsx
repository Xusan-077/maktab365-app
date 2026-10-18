"use client";

import { useEffect, useRef, useState } from "react";
import { yupResolver } from "@hookform/resolvers/yup";
import { useForm } from "react-hook-form";
import { Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { useGoalActions } from "@/hooks/useGoalActions";
import { useGoals } from "@/hooks/useGoals";
import { useToast } from "@/hooks/useToast";
import { cn } from "@/lib/utils/cn";
import { goalSchema, type GoalFormValues } from "@/lib/validation/goal";
import type { StudyGoal } from "@/types/goal";
import { EmptyText } from "./Panel";

interface GoalFormProps {
  defaultTitle?: string;
  label: string;
  submitLabel: string;
  placeholder?: string;
  autoFocus?: boolean;
  /** Muvaffaqiyatsiz bo'lsa xato tashlashi kerak: forma qiymatni saqlab qoladi. */
  onSubmit: (title: string) => Promise<unknown>;
  onCancel?: () => void;
}

/** Maqsad qo'shish va tahrirlash uchun umumiy forma (RHF + Yup). */
function GoalForm({
  defaultTitle = "",
  label,
  submitLabel,
  placeholder,
  autoFocus,
  onSubmit,
  onCancel,
}: GoalFormProps) {
  const t = useTranslations("cabinet.plan");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<GoalFormValues>({
    resolver: yupResolver(goalSchema),
    defaultValues: { title: defaultTitle },
  });

  const submit = handleSubmit(async ({ title }) => {
    try {
      await onSubmit(title);
      reset({ title: onCancel ? title : "" });
    } catch {
      // xabarni chaqiruvchi ko'rsatadi; matn forma ichida qoladi
    }
  });

  return (
    <form onSubmit={submit} noValidate className="flex flex-wrap items-start gap-2">
      <div className="min-w-48 flex-1">
        <Input
          aria-label={label}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete="off"
          error={errors.title?.message && t(`errors.${errors.title.message}`)}
          {...register("title")}
        />
      </div>
      <Button type="submit" loading={isSubmitting}>
        {submitLabel}
      </Button>
      {onCancel && (
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t("cancel")}
        </Button>
      )}
    </form>
  );
}

function GoalItem({ goal }: { goal: StudyGoal }) {
  const t = useTranslations("cabinet.plan");
  const { toast } = useToast();
  const { update, remove } = useGoalActions();
  const [editing, setEditing] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);

  // Tahrirdan chiqqanda fokus "Tahrirlash" tugmasiga qaytadi (klaviatura foydalanuvchisi yo'qolmasin).
  useEffect(() => {
    if (wasEditing.current && !editing) editButton.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  const fail = () => toast({ variant: "error", title: t("failed") });

  if (editing) {
    return (
      <li>
        <GoalForm
          autoFocus
          defaultTitle={goal.title}
          label={t("editLabel")}
          submitLabel={t("save")}
          onCancel={() => setEditing(false)}
          onSubmit={async (title) => {
            try {
              await update.mutateAsync({ id: goal.id, title });
              setEditing(false);
            } catch (error) {
              fail();
              throw error;
            }
          }}
        />
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2">
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-1.5">
        <input
          type="checkbox"
          checked={goal.done}
          onChange={(event) =>
            update.mutate({ id: goal.id, done: event.target.checked }, { onError: fail })
          }
          className="accent-primary-600 size-5 shrink-0"
        />
        <span className={cn("min-w-0 break-words", goal.done && "text-muted line-through")}>
          {goal.title}
        </span>
      </label>
      <Button
        ref={editButton}
        variant="ghost"
        size="icon"
        aria-label={t("edit", { title: goal.title })}
        onClick={() => setEditing(true)}
      >
        <Pencil className="size-4" aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("remove", { title: goal.title })}
        disabled={remove.isPending}
        onClick={() =>
          remove.mutate(goal.id, {
            onSuccess: () => toast({ variant: "info", title: t("removed") }),
            onError: fail,
          })
        }
      >
        <Trash2 className="size-4" aria-hidden />
      </Button>
    </li>
  );
}

/** O'qish rejasi: o'quvchi o'zi qo'shadigan kichik maqsadlar (qo'shish, bajarildi deb belgilash, tahrirlash, o'chirish). */
export function StudyPlan() {
  const t = useTranslations("cabinet.plan");
  const { toast } = useToast();
  const { create } = useGoalActions();
  const { data: goals, isPending, isError } = useGoals();
  const done = goals?.filter((goal) => goal.done).length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted text-sm">{t("lead")}</p>
      <GoalForm
        label={t("fieldLabel")}
        placeholder={t("placeholder")}
        submitLabel={t("add")}
        onSubmit={async (title) => {
          try {
            await create.mutateAsync(title);
          } catch (error) {
            toast({ variant: "error", title: t("failed") });
            throw error;
          }
        }}
      />
      {isPending ? (
        <Skeleton className="h-10 w-full" />
      ) : isError ? (
        <EmptyText>{t("failed")}</EmptyText>
      ) : goals.length === 0 ? (
        <EmptyText>{t("empty")}</EmptyText>
      ) : (
        <>
          <p role="status" className="text-muted text-sm">
            {t("progress", { done, total: goals.length })}
          </p>
          <ul aria-label={t("listLabel")} className="divide-border flex flex-col divide-y">
            {goals.map((goal) => (
              <GoalItem key={goal.id} goal={goal} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
