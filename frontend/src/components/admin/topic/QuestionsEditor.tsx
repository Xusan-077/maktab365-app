"use client";

import { useState } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, FileUp, GripVertical, Image, Pencil, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/hooks/useToast";
import { getAdminApi } from "@/lib/admin/api";
import { canDelete } from "@/lib/admin/permissions";
import { adminKeys, adminQueries } from "@/lib/admin/queries";
import {
  DEFAULT_DIFFICULTY,
  MIN_GAME_QUESTIONS,
  moveItem,
  OPTION_LETTERS,
} from "@/lib/admin/questions";
import type { AdminQuestion, QuestionDifficulty } from "@/lib/admin/types";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { cn } from "@/lib/utils/cn";
import { useAdminIdentity } from "../AdminRoleProvider";
import { ConfirmDialog } from "../ConfirmDialog";
import { QueryError } from "../QueryError";
import { useAdminErrorText } from "../useAdminErrorText";
import { QuestionDialog } from "./QuestionDialog";
import { QuestionImportDialog } from "./QuestionImportDialog";

const DIFFICULTY_BADGE: Record<QuestionDifficulty, BadgeVariant> = {
  easy: "success",
  medium: "primary",
  hard: "accent",
};

const iconButton =
  "text-muted hover:bg-subtle hover:text-foreground inline-flex size-11 shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40";

interface QuestionRowProps {
  question: AdminQuestion;
  index: number;
  disabled: boolean;
  deletable: boolean;
  onToggle: (active: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}

function QuestionRow({
  question,
  index,
  disabled,
  deletable,
  onToggle,
  onEdit,
  onDelete,
}: QuestionRowProps) {
  const t = useTranslations("admin.questions");
  const locale = useLocale() as Locale;
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id, disabled });
  const n = index + 1;
  const correct = [...question.options]
    .sort((a, b) => a.order - b.order)
    .findIndex((option) => option.is_correct);
  const active = question.is_active ?? true;
  const difficulty = question.difficulty ?? DEFAULT_DIFFICULTY;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      data-testid="question-row"
      data-active={active ? "true" : "false"}
      className={cn(
        "border-border bg-surface rounded-ds flex flex-wrap items-center gap-2 border p-2 shadow-xs sm:flex-nowrap",
        isDragging && "ring-ring relative z-10 shadow-lg ring-2",
        !active && "opacity-70",
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        disabled={disabled}
        aria-label={t("drag", { n })}
        className={cn(iconButton, "cursor-grab touch-none active:cursor-grabbing")}
      >
        <GripVertical className="size-5" aria-hidden />
      </button>
      <span className="text-muted w-6 shrink-0 text-right text-sm tabular-nums">{n}</span>
      <div className="min-w-0 flex-1 basis-48">
        <p className="text-foreground line-clamp-2 text-sm font-medium">
          {getLocalized(question.text, locale)}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge variant={DIFFICULTY_BADGE[difficulty]}>{t(`difficulty.${difficulty}`)}</Badge>
          {correct >= 0 && (
            <Badge variant="neutral">{t("answer", { letter: OPTION_LETTERS[correct] })}</Badge>
          )}
          {question.image_url && (
            <Badge variant="neutral" title={t("hasImage")}>
              <Image className="size-3.5" aria-label={t("hasImage")} />
            </Badge>
          )}
        </div>
      </div>
      <Switch
        checked={active}
        onCheckedChange={onToggle}
        label={t(active ? "active" : "inactive")}
        className="w-auto shrink-0"
        testId="question-active"
      />
      <button type="button" onClick={onEdit} aria-label={t("edit", { n })} className={iconButton}>
        <Pencil className="size-4" aria-hidden />
      </button>
      {deletable && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={t("remove", { n })}
          className={cn(iconButton, "hover:text-danger")}
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      )}
    </li>
  );
}

/**
 * Admin: mavzu testlari — savollar ro'yxati, sudrab tartiblash, faol/nofaol, qo'shish/tahrirlash,
 * o'chirish (faqat admin) va ommaviy import. Mavzu o'yinlarda kamida `MIN_GAME_QUESTIONS` faol
 * savol bo'lganda chiqadi.
 */
export function QuestionsEditor({ topicId }: { topicId: string }) {
  const t = useTranslations("admin.questions");
  const queryClient = useQueryClient();
  const errorText = useAdminErrorText();
  const { toast } = useToast();
  const { role } = useAdminIdentity();
  const key = adminKeys.topicQuestions(topicId);
  const {
    data: questions,
    error,
    isPending,
    refetch,
  } = useQuery(adminQueries.topicQuestions(topicId));
  const [editing, setEditing] = useState<AdminQuestion | "new" | null>(null);
  const [importing, setImporting] = useState(false);
  const [removing, setRemoving] = useState<AdminQuestion | null>(null);

  /** Optimistik yozuv: kesh darrov yangilanadi, xatoda serverdan qayta o'qiladi. */
  const optimistic = (next: AdminQuestion[]) => {
    void queryClient.cancelQueries({ queryKey: key });
    queryClient.setQueryData(key, next);
  };
  const onFail = (failure: unknown) => {
    toast({ variant: "error", title: errorText(failure) });
    void queryClient.invalidateQueries({ queryKey: key });
  };

  const reorder = useMutation({
    mutationFn: (ids: string[]) => getAdminApi().reorderQuestions(topicId, ids),
    onSuccess: (data) => queryClient.setQueryData(key, data),
    onError: onFail,
  });
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      getAdminApi().updateQuestion(id, { is_active: active }),
    onError: onFail,
  });
  const remove = useMutation({
    mutationFn: (id: string) => getAdminApi().deleteQuestion(id),
    onSuccess: async () => {
      setRemoving(null);
      await queryClient.invalidateQueries({ queryKey: key });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (error) return <QueryError error={error} onRetry={() => void refetch()} />;
  if (isPending) return <Skeleton className="h-64" />;

  const position = (id: string | number) => questions.findIndex((q) => q.id === id) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) => t("dnd.pickedUp", { n: position(active.id) }),
    onDragOver: ({ active, over }) =>
      over ? t("dnd.over", { n: position(active.id), to: position(over.id) }) : undefined,
    onDragEnd: ({ active, over }) =>
      over ? t("dnd.dropped", { n: position(active.id), to: position(over.id) }) : undefined,
    onDragCancel: ({ active }) => t("dnd.cancelled", { n: position(active.id) }),
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const next = moveItem(questions, position(active.id) - 1, position(over.id) - 1);
    optimistic(next);
    reorder.mutate(next.map((q) => q.id));
  };

  const activeCount = questions.filter((q) => q.is_active ?? true).length;
  const missing = Math.max(MIN_GAME_QUESTIONS - activeCount, 0);

  return (
    <div className="flex flex-col gap-4" data-testid="questions-editor">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-foreground font-medium">
            {t("count", { active: activeCount, total: questions.length })}
          </span>
          {missing === 0 ? (
            <Badge variant="success">{t("ready")}</Badge>
          ) : (
            <Badge variant="neutral">{t("notReady", { n: missing })}</Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setImporting(true)}>
            <FileUp className="size-4" aria-hidden />
            {t("importButton")}
          </Button>
          <Button onClick={() => setEditing("new")} data-testid="question-add">
            <Plus className="size-4" aria-hidden />
            {t("add")}
          </Button>
        </div>
      </div>

      {questions.length === 0 ? (
        <EmptyState icon={ClipboardCheck}>{t("empty", { min: MIN_GAME_QUESTIONS })}</EmptyState>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
          accessibility={{
            announcements,
            screenReaderInstructions: { draggable: t("dnd.instructions") },
          }}
        >
          <SortableContext
            items={questions.map((q) => q.id)}
            strategy={verticalListSortingStrategy}
          >
            <ol className="flex flex-col gap-2" aria-label={t("listLabel")}>
              {questions.map((question, index) => (
                <QuestionRow
                  key={question.id}
                  question={question}
                  index={index}
                  disabled={reorder.isPending}
                  deletable={canDelete(role)}
                  onToggle={(active) => {
                    optimistic(
                      questions.map((q) =>
                        q.id === question.id ? { ...q, is_active: active } : q,
                      ),
                    );
                    toggle.mutate({ id: question.id, active });
                  }}
                  onEdit={() => setEditing(question)}
                  onDelete={() => {
                    remove.reset();
                    setRemoving(question);
                  }}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}

      <QuestionDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        topicId={topicId}
        question={editing === "new" || editing === null ? undefined : editing}
      />
      <QuestionImportDialog open={importing} onOpenChange={setImporting} topicId={topicId} />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t("removeTitle")}
        description={t("removeDescription", { n: removing ? position(removing.id) : 0 })}
        confirmLabel={t("removeConfirm")}
        pending={remove.isPending}
        error={remove.isError ? errorText(remove.error) : undefined}
        onConfirm={() => removing && remove.mutate(removing.id)}
      />
    </div>
  );
}
