"use client";

import { useState, type KeyboardEvent } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  FlaskConical,
  GripVertical,
  Lightbulb,
  List,
  Plus,
  StickyNote,
  Tags,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Controller, get, useFormContext, useFormState, type FieldPath } from "react-hook-form";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import type { SummaryBlockType, SummaryInput } from "@/lib/topic-materials/types";
import { cn } from "@/lib/utils/cn";
import { SUMMARY_LIMITS } from "@/lib/validation/topic-materials";

export const BLOCK_ICONS: Record<SummaryBlockType, LucideIcon> = {
  idea: Lightbulb,
  bullets: List,
  chips: Tags,
  teacher_note: StickyNote,
  example: FlaskConical,
};

const iconButton =
  "text-muted hover:bg-subtle hover:text-foreground inline-flex size-11 shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40";

/** Yup xabar kaliti → matn (`admin.topic.errors.*`). */
function useFieldError() {
  const t = useTranslations("admin.topic.errors");
  const { errors } = useFormState<SummaryInput>();
  return (path: string): string | undefined => {
    const message: unknown = get(errors, path)?.message;
    if (typeof message !== "string" || !message) return undefined;
    return t.has(message) ? t(message) : t("invalid");
  };
}

function BulletsField({ index, disabled }: { index: number; disabled?: boolean }) {
  const t = useTranslations("admin.topic.summary");
  const fieldError = useFieldError();
  const { control } = useFormContext<SummaryInput>();
  const name = `blocks.${index}.items` as FieldPath<SummaryInput>;
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        const items = (field.value ?? []) as { lead: string; text: string }[];
        const update = (next: { lead: string; text: string }[]) => field.onChange(next);
        return (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-foreground mb-1 text-sm font-medium">{t("bullets")}</legend>
            {items.map((item, row) => {
              const error = fieldError(`${name}.${row}.text`);
              return (
                <div key={row} className="flex items-start gap-2" data-testid="bullet-row">
                  <Input
                    aria-label={t("bulletLead", { n: row + 1 })}
                    placeholder={t("bulletLeadPlaceholder")}
                    value={item.lead}
                    maxLength={SUMMARY_LIMITS.lead}
                    disabled={disabled}
                    className="w-32 sm:w-40"
                    onChange={(event) =>
                      update(
                        items.map((it, i) =>
                          i === row ? { ...it, lead: event.target.value } : it,
                        ),
                      )
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <Input
                      aria-label={t("bulletText", { n: row + 1 })}
                      placeholder={t("bulletTextPlaceholder")}
                      value={item.text}
                      error={error}
                      disabled={disabled}
                      onChange={(event) =>
                        update(
                          items.map((it, i) =>
                            i === row ? { ...it, text: event.target.value } : it,
                          ),
                        )
                      }
                    />
                  </div>
                  <button
                    type="button"
                    className={cn(iconButton, "hover:text-danger")}
                    disabled={disabled}
                    aria-label={t("removeBullet", { n: row + 1 })}
                    onClick={() => update(items.filter((_, i) => i !== row))}
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </div>
              );
            })}
            {fieldError(name) && (
              <p role="alert" className="text-danger text-sm">
                {fieldError(name)}
              </p>
            )}
            <div>
              <button
                type="button"
                className="text-link inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium hover:underline disabled:opacity-40"
                disabled={disabled || items.length >= SUMMARY_LIMITS.bullets}
                onClick={() => update([...items, { lead: "", text: "" }])}
              >
                <Plus className="size-4" aria-hidden />
                {t("addBullet")}
              </button>
            </div>
          </fieldset>
        );
      }}
    />
  );
}

function ChipsField({ index, disabled }: { index: number; disabled?: boolean }) {
  const t = useTranslations("admin.topic.summary");
  const fieldError = useFieldError();
  const { control } = useFormContext<SummaryInput>();
  const [draft, setDraft] = useState("");
  const name = `blocks.${index}.items` as FieldPath<SummaryInput>;
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        const items = (field.value ?? []) as string[];
        const full = items.length >= SUMMARY_LIMITS.chips;
        const commit = () => {
          const next = draft
            .split(",")
            .map((part) => part.trim())
            .filter((part) => part && !items.includes(part));
          if (next.length) field.onChange([...items, ...next].slice(0, SUMMARY_LIMITS.chips));
          setDraft("");
        };
        const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            commit();
          } else if (event.key === "Backspace" && !draft && items.length) {
            field.onChange(items.slice(0, -1));
          }
        };
        return (
          <div className="flex flex-col gap-2">
            {items.length > 0 && (
              <ul className="flex flex-wrap gap-2" aria-label={t("chips")}>
                {items.map((chip, i) => (
                  <li
                    key={`${chip}-${i}`}
                    className="bg-ds-accent-tint text-ds-accent-ink inline-flex items-center gap-1 rounded-full py-0.5 pr-0.5 pl-3 text-sm font-semibold"
                  >
                    {chip}
                    <button
                      type="button"
                      disabled={disabled}
                      aria-label={t("removeChip", { chip })}
                      onClick={() => field.onChange(items.filter((_, j) => j !== i))}
                      className="hover:bg-ds-surface inline-flex size-11 items-center justify-center rounded-full sm:size-8"
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Input
              label={t("chips")}
              hint={full ? t("chipsFull") : t("chipsHint")}
              error={fieldError(name)}
              value={draft}
              disabled={disabled || full}
              maxLength={SUMMARY_LIMITS.chip * 4}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onKeyDown}
              onBlur={commit}
            />
          </div>
        );
      }}
    />
  );
}

export interface SummaryBlockCardProps {
  id: string;
  index: number;
  type: SummaryBlockType;
  disabled?: boolean;
  onRemove: () => void;
}

/** Muharrirdagi bitta blok: sudrash dastagi, tip nomi, tipga mos maydonlar, o'chirish. */
export function SummaryBlockCard({ id, index, type, disabled, onRemove }: SummaryBlockCardProps) {
  const t = useTranslations("admin.topic.summary");
  const { register } = useFormContext<SummaryInput>();
  const fieldError = useFieldError();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });
  const Icon = BLOCK_ICONS[type];
  const n = index + 1;
  const path = (field: string) => `blocks.${index}.${field}` as FieldPath<SummaryInput>;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      data-testid="summary-block-card"
      data-type={type}
      className={cn(
        "border-border bg-surface rounded-ds flex flex-col gap-3 border p-3 shadow-xs",
        isDragging && "ring-ring relative z-10 shadow-lg ring-2",
      )}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          disabled={disabled}
          aria-label={t("drag", { n, type: t(`types.${type}.title`) })}
          className={cn(iconButton, "cursor-grab touch-none active:cursor-grabbing")}
          data-testid="summary-block-drag"
        >
          <GripVertical className="size-5" aria-hidden />
        </button>
        <Icon className="text-ds-accent size-5 shrink-0" aria-hidden />
        <h3 className="text-foreground min-w-0 flex-1 text-sm font-semibold">
          <span className="text-muted mr-1 tabular-nums">{n}.</span>
          {t(`types.${type}.title`)}
        </h3>
        <button
          type="button"
          className={cn(iconButton, "hover:text-danger")}
          disabled={disabled}
          aria-label={t("remove", { n })}
          onClick={onRemove}
          data-testid="summary-block-remove"
        >
          <Trash2 className="size-5" aria-hidden />
        </button>
      </div>

      {type === "idea" && (
        <>
          <Input
            label={t("fields.title")}
            error={fieldError(path("title"))}
            disabled={disabled}
            {...register(path("title"))}
          />
          <Textarea
            label={t("fields.text")}
            rows={3}
            error={fieldError(path("text"))}
            disabled={disabled}
            {...register(path("text"))}
          />
        </>
      )}
      {type === "bullets" && <BulletsField index={index} disabled={disabled} />}
      {type === "chips" && (
        <>
          <Input
            label={t("fields.label")}
            hint={t("fields.labelHint")}
            error={fieldError(path("label"))}
            disabled={disabled}
            {...register(path("label"))}
          />
          <ChipsField index={index} disabled={disabled} />
        </>
      )}
      {(type === "teacher_note" || type === "example") && (
        <Textarea
          label={t(`fields.${type}`)}
          hint={type === "teacher_note" ? t("fields.teacherNoteHint") : undefined}
          rows={3}
          error={fieldError(path("text"))}
          disabled={disabled}
          {...register(path("text"))}
        />
      )}
    </li>
  );
}
