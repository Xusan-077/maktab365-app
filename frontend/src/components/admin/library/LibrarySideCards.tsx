"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImageUp, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { BookCover } from "@/components/books/BookCover";
import { useAdminErrorText } from "@/components/admin/useAdminErrorText";
import { BookStatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/hooks/useToast";
import { getAdminApi } from "@/lib/admin/api";
import { coverImageProblem } from "@/lib/admin/cover";
import { getAdminLibraryApi, type AdminBook } from "@/lib/library/admin-api";
import { libraryKeys } from "@/lib/library/admin-queries";

const CARD = "border-border bg-surface flex flex-col gap-3 rounded-xl border p-4";

/** Muqova: hozirgisi, o'z rasmini yuklash yoki birinchi betdan qayta olish. */
export function LibraryCoverCard({ book }: { book: AdminBook }) {
  const t = useTranslations("admin.library.cover");
  const errorText = useAdminErrorText();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: libraryKeys.root });

  const replace = useMutation({
    mutationFn: async (file: File) => {
      const uploaded = await getAdminApi().upload(file, "cover");
      return getAdminLibraryApi().update(book.id, { cover_image: uploaded.path });
    },
    onSuccess: () => void refresh(),
  });
  const auto = useMutation({
    mutationFn: async () => {
      await getAdminLibraryApi().update(book.id, { cover_image: "" });
      return getAdminLibraryApi().reprocess(book.id);
    },
    onSuccess: () => {
      toast({ variant: "success", title: t("auto") });
      void refresh();
    },
  });

  function onPick(file: File | undefined) {
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    if (coverImageProblem(file)) {
      setProblem(true);
      return;
    }
    setProblem(false);
    replace.mutate(file);
  }

  const error = replace.error ?? auto.error;

  return (
    <section aria-labelledby="library-cover" className={CARD}>
      <h2 id="library-cover" className="font-semibold">
        {t("title")}
      </h2>
      <div className="w-32">
        <BookCover title={book.title} type={book.type ?? "other"} src={book.cover_url} />
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => onPick(event.target.files?.[0])}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          loading={replace.isPending}
          onClick={() => inputRef.current?.click()}
        >
          <ImageUp className="size-4" aria-hidden />
          {t("upload")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          loading={auto.isPending}
          disabled={!book.has_file || book.status === "processing"}
          onClick={() => auto.mutate()}
        >
          <RotateCcw className="size-4" aria-hidden />
          {t("useAuto")}
        </Button>
      </div>
      <p className="text-muted text-sm">{t("hint")}</p>
      {problem && (
        <p role="alert" className="text-danger text-sm">
          {t("invalid")}
        </p>
      )}
      {error && (
        <p role="alert" className="text-danger text-sm">
          {errorText(error)}
        </p>
      )}
    </section>
  );
}

/** Nashr: tayyor kitobni saytga chiqarish yoki qaytarish. */
export function LibraryPublishCard({ book }: { book: AdminBook }) {
  const t = useTranslations("admin.library.publish");
  const errorText = useAdminErrorText();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const canPublish = book.allowed_transitions.includes("published");
  const canUnpublish = book.allowed_transitions.includes("draft");

  const transition = useMutation({
    mutationFn: (to: "draft" | "published") => getAdminLibraryApi().transition(book.id, to),
    onSuccess: (_book, to) => {
      toast({
        variant: "success",
        title: t(to === "published" ? "publishedToast" : "unpublishedToast"),
      });
      void queryClient.invalidateQueries({ queryKey: libraryKeys.root });
    },
  });

  return (
    <section aria-labelledby="library-publish" className={CARD}>
      <div className="flex items-center justify-between gap-2">
        <h2 id="library-publish" className="font-semibold">
          {t("title")}
        </h2>
        <BookStatusBadge published={book.is_published} />
      </div>
      <p className="text-muted text-sm">
        {t(
          !book.is_published && !canPublish
            ? "notReady"
            : book.is_published
              ? "published"
              : "draft",
        )}
      </p>
      {canPublish && (
        <Button loading={transition.isPending} onClick={() => transition.mutate("published")}>
          {t("publish")}
        </Button>
      )}
      {canUnpublish && (
        <Button
          variant="secondary"
          loading={transition.isPending}
          onClick={() => transition.mutate("draft")}
        >
          {t("unpublish")}
        </Button>
      )}
      {transition.isError && (
        <p role="alert" className="text-danger text-sm">
          {errorText(transition.error)}
        </p>
      )}
    </section>
  );
}
