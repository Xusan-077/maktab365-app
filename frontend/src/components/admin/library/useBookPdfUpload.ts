"use client";

import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { uploadPdf, xhrSender } from "@/lib/admin/pdf-upload";
import { BFF_PREFIX } from "@/lib/auth/config";
import { getAdminLibraryApi } from "@/lib/library/admin-api";
import { libraryKeys } from "@/lib/library/admin-queries";

export type BookUploadPhase = "idle" | "uploading" | "error";

export interface BookUploadState {
  phase: BookUploadPhase;
  /** 0..1 (faqat `uploading` fazasida). */
  progress: number;
  error: unknown;
}

const IDLE: BookUploadState = { phase: "idle", progress: 0, error: null };

/** Lokal (dev) rejim: PDF backend'ga BFF orqali multipart bilan boradi (oxirgi `/` siz). */
const proxyUrl = (bookId: string) => `${BFF_PREFIX}/api/v1/admin/books/${bookId}/upload`;

/**
 * PDF yuklash: `uploadPdf` (bo'laklab, progress, qayta urinish) kitob endpoint'lariga ulanadi.
 * Yuklash tugagach server sahifalarni fonda tayyorlaydi; holatni `libraryQueries.book` kuzatadi.
 */
export function useBookPdfUpload(bookId: string) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<BookUploadState>(IDLE);
  const controller = useRef<AbortController | null>(null);

  const run = useCallback(
    async (file: File): Promise<boolean> => {
      controller.current = new AbortController();
      setState({ phase: "uploading", progress: 0, error: null });
      try {
        await uploadPdf({
          api: getAdminLibraryApi().asPdfUploadApi(),
          send: xhrSender,
          bookId,
          file,
          proxyUrl: proxyUrl(bookId),
          signal: controller.current.signal,
          onProgress: (progress) => setState((s) => ({ ...s, progress })),
        });
        setState(IDLE);
        await queryClient.invalidateQueries({ queryKey: libraryKeys.root });
        return true;
      } catch (error) {
        const aborted = error instanceof DOMException && error.name === "AbortError";
        setState(aborted ? IDLE : { phase: "error", progress: 0, error });
        return false;
      }
    },
    [bookId, queryClient],
  );

  const cancel = useCallback(() => controller.current?.abort(), []);
  const reset = useCallback(() => setState(IDLE), []);

  return { state, run, cancel, reset };
}
