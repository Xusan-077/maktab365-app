"use client";

import { useCallback, useRef, useState } from "react";
import { getMyBooksApi, type PageEntry } from "@/lib/books/api";
import { fetchPageSize } from "@/lib/books/page-image";
import { parsedAnnotations } from "@/lib/books/entries";
import {
  bookNotesMarkdown,
  downloadBlob,
  EXPORT_MAX_PAGES,
  fileSlug,
  pageFileName,
  renderAnnotationsOnly,
  textBlob,
  zipBlobs,
  type ZipEntryInput,
} from "@/lib/books/export";

export type ExportState =
  | { status: "idle" }
  | { status: "running"; done: number; total: number }
  | { status: "done"; truncated: boolean }
  | { status: "error" };

export interface BookExportLabels {
  page: (page: number) => string;
  texts: string;
  notesFile: string;
}

/**
 * Kitobning barcha yozuvlarini ZIP qilib yuklaydi: har bet — faqat annotatsiyali shaffof PNG (kitob sahifasisiz), yana yon daftar `.md`.
 * Brauzer xotirasi uchun `EXPORT_MAX_PAGES` bet bilan cheklangan (oxirgi o'zgartirilganlari).
 */
export function useBookExport(bookId: string, title: string, labels: BookExportLabels) {
  const [state, setState] = useState<ExportState>({ status: "idle" });
  const cancelled = useRef(false);

  const cancel = useCallback(() => {
    cancelled.current = true;
  }, []);

  const start = useCallback(async () => {
    cancelled.current = false;
    setState({ status: "running", done: 0, total: 0 });
    try {
      const api = getMyBooksApi();
      const all: PageEntry[] = [];
      for (let page = 1; ; page += 1) {
        const chunk = await api.entries({ book: bookId, page, page_size: 50 });
        all.push(...chunk.results);
        if (page * chunk.page_size >= chunk.count) break;
      }
      const truncated = all.length > EXPORT_MAX_PAGES;
      const entries = [...all].sort((a, b) => a.page - b.page).slice(0, EXPORT_MAX_PAGES);
      const files: ZipEntryInput[] = [];
      for (const [index, entry] of entries.entries()) {
        if (cancelled.current) {
          setState({ status: "idle" });
          return;
        }
        setState({ status: "running", done: index, total: entries.length });
        const items = parsedAnnotations(entry);
        if (items.length === 0) continue;
        const size = await fetchPageSize(bookId, entry.page);
        files.push({
          name: pageFileName(title, entry.page, "png"),
          blob: await renderAnnotationsOnly(size, items),
        });
      }
      const notes = bookNotesMarkdown(title, entries, labels);
      files.push({ name: labels.notesFile, blob: textBlob(notes) });
      downloadBlob(await zipBlobs(files), `${fileSlug(title)}-yozuvlar.zip`);
      setState({ status: "done", truncated });
    } catch {
      setState({ status: "error" });
    }
  }, [bookId, title, labels]);

  return { state, start, cancel };
}
