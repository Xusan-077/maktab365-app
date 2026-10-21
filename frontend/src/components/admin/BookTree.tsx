"use client";

import { useMemo, useState, type DragEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, GripVertical, Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/hooks/useToast";
import { getAdminApi } from "@/lib/admin/api";
import { canDelete } from "@/lib/admin/permissions";
import { ADMIN_ROOT_KEY, adminQueries } from "@/lib/admin/queries";
import { adminNewTopicPath, adminTopicPath } from "@/lib/admin/routes";
import {
  buildTree,
  diffToReorder,
  moveChapter,
  moveTopic,
  type TreeChapter,
} from "@/lib/admin/tree";
import type { AdminTopicItem } from "@/lib/admin/types";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { useAdminIdentity } from "./AdminRoleProvider";
import { ChapterDialog } from "./ChapterDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import { QueryError } from "./QueryError";
import { TopicStatusBadge } from "./StatusBadge";
import { TransitionButtons } from "./TransitionButtons";
import { useAdminErrorText } from "./useAdminErrorText";

type Drag = { kind: "chapter" | "topic"; id: string } | null;
type Deletion = { kind: "chapter" | "topic"; id: string; title: string } | null;

const dragHandleClasses =
  "text-muted hover:text-foreground flex size-8 shrink-0 cursor-grab items-center justify-center rounded-md active:cursor-grabbing";

function MoveButtons({
  label,
  index,
  count,
  onMove,
}: {
  label: string;
  index: number;
  count: number;
  onMove: (toIndex: number) => void;
}) {
  const t = useTranslations("admin.tree");
  return (
    <span className="flex">
      <Button
        variant="ghost"
        size="sm"
        className="size-8 px-0"
        aria-label={t("moveUp", { title: label })}
        disabled={index <= 0}
        onClick={() => onMove(index - 1)}
      >
        <ArrowUp className="size-4" aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="size-8 px-0"
        aria-label={t("moveDown", { title: label })}
        disabled={index >= count - 1}
        onClick={() => onMove(index + 1)}
      >
        <ArrowDown className="size-4" aria-hidden />
      </Button>
    </span>
  );
}

/**
 * Boblar va mavzular daraxti. Tartibni sudrab (HTML5 drag&drop) yoki ↑/↓ tugmalari bilan o'zgartirish;
 * har o'zgarish bir `reorder` so'rovi (`diffToReorder`), xatoda daraxt serverdagi holatga qaytadi.
 */
export function BookTree({ bookId }: { bookId: string }) {
  const t = useTranslations("admin.tree");
  const tc = useTranslations("admin.common");
  const locale = useLocale() as Locale;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { role } = useAdminIdentity();
  const errorText = useAdminErrorText();
  const { data, error, isPending, refetch } = useQuery(adminQueries.tree(bookId));

  const serverTree = useMemo(() => (data ? buildTree(data.chapters, data.topics) : []), [data]);
  // Reorder so'rovi ketayotganda ko'rsatiladigan optimistik daraxt.
  const [pending, setPending] = useState<TreeChapter[] | null>(null);
  const tree = pending ?? serverTree;
  const [drag, setDrag] = useState<Drag>(null);
  const [chapterDialog, setChapterDialog] = useState<
    { mode: "create" } | { mode: "edit"; chapter: TreeChapter } | null
  >(null);
  const [deletion, setDeletion] = useState<Deletion>(null);

  const reorder = useMutation({
    mutationFn: (body: NonNullable<ReturnType<typeof diffToReorder>>) =>
      getAdminApi().reorder(bookId, body),
    onError: (e) => toast({ variant: "error", title: errorText(e) }),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_ROOT_KEY });
      setPending(null);
    },
  });

  const remove = useMutation({
    mutationFn: (target: NonNullable<Deletion>) =>
      target.kind === "chapter"
        ? getAdminApi().deleteChapter(target.id)
        : getAdminApi().deleteTopic(target.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_ROOT_KEY });
      setDeletion(null);
    },
  });

  function commit(next: TreeChapter[]) {
    const body = diffToReorder(serverTree, next);
    if (!body || reorder.isPending) return;
    setPending(next);
    reorder.mutate(body);
  }

  const titleOf = (text: TreeChapter["title"]) => getLocalized(text, locale);

  function onDropOnTopic(event: DragEvent, chapterId: string, index: number) {
    if (drag?.kind !== "topic") return;
    event.preventDefault();
    event.stopPropagation();
    commit(moveTopic(tree, drag.id, chapterId, index));
    setDrag(null);
  }

  function onDropOnChapter(event: DragEvent, chapter: TreeChapter, index: number) {
    if (!drag) return;
    event.preventDefault();
    if (drag.kind === "chapter") commit(moveChapter(tree, drag.id, index));
    else commit(moveTopic(tree, drag.id, chapter.id, chapter.topics.length));
    setDrag(null);
  }

  const allowDrop = (event: DragEvent, kind: NonNullable<Drag>["kind"][]) => {
    if (drag && kind.includes(drag.kind)) event.preventDefault();
  };

  function topicRow(topic: AdminTopicItem, chapter: TreeChapter, index: number) {
    const title = titleOf(topic.title);
    return (
      <li
        key={topic.id}
        draggable
        onDragStart={(event) => {
          event.stopPropagation();
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", topic.id);
          setDrag({ kind: "topic", id: topic.id });
        }}
        onDragEnd={() => setDrag(null)}
        onDragOver={(event) => allowDrop(event, ["topic"])}
        onDrop={(event) => onDropOnTopic(event, chapter.id, index)}
        data-testid="tree-topic"
        className={cn(
          "bg-surface hover:border-border flex flex-wrap items-center gap-2 rounded-lg border border-transparent px-2 py-1.5",
          drag?.kind === "topic" && drag.id === topic.id && "opacity-40",
        )}
      >
        <span aria-hidden className={dragHandleClasses}>
          <GripVertical className="size-4" />
        </span>
        <Link
          href={adminTopicPath(topic.id)}
          className="text-link min-w-0 flex-1 truncate text-sm font-medium underline-offset-4 hover:underline"
        >
          {title}
        </Link>
        <TopicStatusBadge status={topic.status} />
        <TransitionButtons topicId={topic.id} status={topic.status} />
        <MoveButtons
          label={title}
          index={index}
          count={chapter.topics.length}
          onMove={(to) => commit(moveTopic(tree, topic.id, chapter.id, to))}
        />
        {canDelete(role) && (
          <Button
            variant="ghost"
            size="sm"
            className="size-8 px-0"
            aria-label={t("deleteTopic", { title })}
            onClick={() => setDeletion({ kind: "topic", id: topic.id, title })}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        )}
      </li>
    );
  }

  return (
    <section aria-labelledby="tree-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="tree-title" className="text-xl font-bold">
            {t("title")}
          </h2>
          <p className="text-muted text-sm">{t("hint")}</p>
        </div>
        <Button variant="secondary" onClick={() => setChapterDialog({ mode: "create" })}>
          <Plus className="size-4" aria-hidden />
          {t("addChapter")}
        </Button>
      </div>

      {error ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : isPending ? (
        <div role="status" aria-label={tc("loading")} className="flex flex-col gap-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : tree.length === 0 ? (
        <EmptyState
          icon={Layers}
          action={
            <Button size="sm" onClick={() => setChapterDialog({ mode: "create" })}>
              {t("addChapter")}
            </Button>
          }
        >
          {t("empty")}
        </EmptyState>
      ) : (
        <ol
          className={cn("flex flex-col gap-3", reorder.isPending && "opacity-70")}
          data-testid="tree"
        >
          {tree.map((chapter, index) => {
            const title = titleOf(chapter.title);
            return (
              <li key={chapter.id} data-testid="tree-chapter">
                <Card
                  className="flex flex-col gap-2 p-3"
                  onDragOver={(event) => allowDrop(event, ["chapter", "topic"])}
                  onDrop={(event) => onDropOnChapter(event, chapter, index)}
                >
                  <div
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", chapter.id);
                      setDrag({ kind: "chapter", id: chapter.id });
                    }}
                    onDragEnd={() => setDrag(null)}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <span aria-hidden className={dragHandleClasses}>
                      <GripVertical className="size-4" />
                    </span>
                    <CardTitle className="min-w-0 flex-1 truncate">
                      {index + 1}. {title}
                    </CardTitle>
                    <Link
                      href={adminNewTopicPath(bookId, chapter.id)}
                      className={buttonVariants({ variant: "secondary", size: "sm" })}
                    >
                      <Plus className="size-4" aria-hidden />
                      {t("addTopic")}
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="size-8 px-0"
                      aria-label={t("editChapter", { title })}
                      onClick={() => setChapterDialog({ mode: "edit", chapter })}
                    >
                      <Pencil className="size-4" aria-hidden />
                    </Button>
                    <MoveButtons
                      label={title}
                      index={index}
                      count={tree.length}
                      onMove={(to) => commit(moveChapter(tree, chapter.id, to))}
                    />
                    {canDelete(role) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="size-8 px-0"
                        aria-label={t("deleteChapter", { title })}
                        onClick={() => setDeletion({ kind: "chapter", id: chapter.id, title })}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    )}
                  </div>
                  {chapter.topics.length === 0 ? (
                    <p className="text-muted px-2 py-3 text-sm">{t("emptyChapter")}</p>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {chapter.topics.map((topic, topicIndex) =>
                        topicRow(topic, chapter, topicIndex),
                      )}
                    </ul>
                  )}
                </Card>
              </li>
            );
          })}
        </ol>
      )}

      <ChapterDialog
        open={chapterDialog !== null}
        onOpenChange={(open) => !open && setChapterDialog(null)}
        bookId={bookId}
        chapter={chapterDialog?.mode === "edit" ? chapterDialog.chapter : undefined}
      />
      <ConfirmDialog
        open={deletion !== null}
        onOpenChange={(open) => !open && setDeletion(null)}
        title={
          deletion ? t(deletion.kind === "chapter" ? "deleteChapterTitle" : "deleteTopicTitle") : ""
        }
        description={deletion ? t("deleteDescription", { title: deletion.title }) : ""}
        confirmLabel={tc("delete")}
        pending={remove.isPending}
        error={remove.isError ? errorText(remove.error) : undefined}
        onConfirm={() => deletion && remove.mutate(deletion)}
      />
    </section>
  );
}
