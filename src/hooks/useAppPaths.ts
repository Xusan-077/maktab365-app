"use client";

import { useMemo } from "react";
import {
  baseHome,
  bookPath,
  catalogPath,
  subjectPath,
  subjectsPath,
  topicBlockPath,
  topicPath,
  type AppBase,
} from "@/lib/utils/routes";
import { useAppBase } from "./useAppBase";

/** Joriy baza (marketing | kabinet | ustoz) bo'yicha yo'l yasovchilar. */
export function useAppPaths() {
  const base: AppBase = useAppBase();
  return useMemo(
    () => ({
      base,
      home: baseHome(base),
      catalog: catalogPath(base),
      subjects: subjectsPath(base),
      subject: (slug: string) => subjectPath(slug, base),
      book: (bookId: string) => bookPath(bookId, base),
      topic: (bookId: string, topicId: string) => topicPath(bookId, topicId, base),
      topicBlock: (bookId: string, topicId: string, blockId: string) =>
        topicBlockPath(bookId, topicId, blockId, base),
    }),
    [base],
  );
}
