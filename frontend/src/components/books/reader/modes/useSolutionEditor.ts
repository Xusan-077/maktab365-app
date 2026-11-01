"use client";

import { useCallback, useState } from "react";
import {
  MAX_PER_PAGE,
  newAnnotationId,
  SOLUTION_BODY_MAX,
  SOLUTION_TITLE_MAX,
  type Annotation,
  type NormRect,
} from "@/lib/books/annotations";
import type { SolutionTarget } from "../workspace/AnnotationCanvas";
import type { SolutionDraft } from "./SolutionDialog";

type Solution = Extract<Annotation, { type: "solution" }>;

export const isSolution = (item: Annotation): item is Solution => item.type === "solution";

interface Open {
  /** Mavjud yechim id'si; yangi bo'lsa `null`. */
  id: string | null;
  rect: NormRect | null;
  draft: SolutionDraft;
}

export interface UseSolutionEditorArgs {
  items: readonly Annotation[];
  onCommit: (items: readonly Annotation[]) => void;
  onLimit: () => void;
}

/**
 * Matematika kitob: yechim maydonini yaratish/tahrirlash/o'chirish. Maydon bet annotatsiyasi sifatida
 * saqlanadi (boshqa annotatsiyalar bilan bir xil tarix, sinxronlash va oflayn navbat).
 */
export function useSolutionEditor({ items, onCommit, onLimit }: UseSolutionEditorArgs) {
  const [open, setOpen] = useState<Open | null>(null);

  const start = useCallback(
    (target: SolutionTarget) => {
      if (target.kind === "new") {
        setOpen({ id: null, rect: target.rect, draft: { title: "", body: "" } });
        return;
      }
      const found = items.find((item) => item.id === target.id);
      if (found && isSolution(found)) {
        setOpen({
          id: found.id,
          rect: found.data.rect,
          draft: { title: found.data.title, body: found.data.body },
        });
      }
    },
    [items],
  );

  const close = useCallback(() => setOpen(null), []);

  const save = useCallback(
    (draft: SolutionDraft) => {
      if (!open) return;
      const title = draft.title.slice(0, SOLUTION_TITLE_MAX);
      const body = draft.body.slice(0, SOLUTION_BODY_MAX);
      if (open.id) {
        onCommit(
          items.map((item) =>
            item.id === open.id && isSolution(item)
              ? { ...item, data: { ...item.data, title, body } }
              : item,
          ),
        );
      } else if (open.rect) {
        if (items.length >= MAX_PER_PAGE) onLimit();
        else {
          onCommit([
            ...items,
            { id: newAnnotationId(), type: "solution", data: { rect: open.rect, title, body } },
          ]);
        }
      }
      setOpen(null);
    },
    [open, items, onCommit, onLimit],
  );

  const remove = useCallback(() => {
    if (open?.id) onCommit(items.filter((item) => item.id !== open.id));
    setOpen(null);
  }, [open, items, onCommit]);

  return { open, start, close, save, remove };
}
