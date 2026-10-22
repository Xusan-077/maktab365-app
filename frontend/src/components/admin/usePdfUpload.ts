"use client";

import { useCallback, useRef, useState } from "react";
import { getAdminApi } from "@/lib/admin/api";
import { uploadPdf, xhrSender } from "@/lib/admin/pdf-upload";
import type { AdminPdfBook } from "@/lib/admin/types";
import { renderCoverFile } from "@/lib/pdf/thumbnail";

export interface PdfUploadResult {
  book: AdminPdfBook;
  coverFailed: boolean;
}

export type PdfUploadPhase = "idle" | "uploading" | "cover" | "done" | "error";

export interface PdfUploadState {
  phase: PdfUploadPhase;
  /** 0..1 (faqat `uploading` fazasida ma'noli). */
  progress: number;
  error: unknown;
  /** Muqova yaratilmadi (yuklash esa muvaffaqiyatli): ogohlantirish ko'rsatiladi. */
  coverFailed: boolean;
}

const IDLE: PdfUploadState = { phase: "idle", progress: 0, error: null, coverFailed: false };

/**
 * PDF yuklash oqimi: fayl (progress bilan) → 1-sahifadan muqova (adminning brauzerida) → `PATCH cover`.
 * Muqova xatosi yuklashni bekor qilmaydi: fayl allaqachon saqlangan.
 */
export function usePdfUpload() {
  const [state, setState] = useState<PdfUploadState>(IDLE);
  const controller = useRef<AbortController | null>(null);

  const run = useCallback(async (bookId: string, file: File): Promise<PdfUploadResult> => {
    const api = getAdminApi();
    controller.current = new AbortController();
    setState({ ...IDLE, phase: "uploading" });
    try {
      let book = await uploadPdf({
        api,
        send: xhrSender,
        bookId,
        file,
        signal: controller.current.signal,
        onProgress: (progress) => setState((s) => ({ ...s, progress })),
      });
      setState((s) => ({ ...s, phase: "cover", progress: 1 }));
      let coverFailed = false;
      try {
        const cover = await renderCoverFile(file);
        const uploaded = await api.upload(cover, "cover");
        book = await api.updatePdfBook(bookId, { cover: uploaded.path });
      } catch (error) {
        console.warn("PDF cover generation failed", error);
        coverFailed = true;
      }
      setState({ phase: "done", progress: 1, error: null, coverFailed });
      return { book, coverFailed };
    } catch (error) {
      setState({ ...IDLE, phase: "error", error });
      throw error;
    }
  }, []);

  const cancel = useCallback(() => controller.current?.abort(), []);
  const reset = useCallback(() => setState(IDLE), []);

  return { state, run, cancel, reset };
}
