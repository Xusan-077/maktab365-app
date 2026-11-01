"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useAdminErrorText } from "@/components/admin/useAdminErrorText";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/hooks/useToast";
import { keyErrorCode, keyErrors, keyToText } from "@/lib/library/answer-key";
import { getAdminLibraryApi, type AdminBook, type AnswerKeyMode } from "@/lib/library/admin-api";
import { libraryKeys, libraryQueries } from "@/lib/library/admin-queries";

const CARD = "border-border bg-surface flex flex-col gap-3 rounded-xl border p-4";
const MAX_SHOWN_ERRORS = 8;

/**
 * Test kitob: javoblar kaliti. Qatorlar `bet, savol, javob` (CSV yoki oddiy matn) ko'rinishida
 * ommaviy kiritiladi; xato qatorlar raqami bilan ko'rsatiladi, hech narsa yarim saqlanmaydi.
 */
export function LibraryAnswerKeyCard({ book }: { book: AdminBook }) {
  const t = useTranslations("admin.library.answerKey");
  const errorText = useAdminErrorText();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const key = useQuery({ ...libraryQueries.answerKey(book.id), enabled: book.page_count > 0 });
  const [text, setText] = useState("");
  const [mode, setMode] = useState<AnswerKeyMode>("replace");
  const [confirmClear, setConfirmClear] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: libraryKeys.answerKey(book.id) });

  const save = useMutation({
    mutationFn: () => getAdminLibraryApi().importAnswerKey(book.id, text, mode),
    onSuccess: (result) => {
      toast({
        variant: "success",
        title: t("saved", { count: result.saved, total: result.total }),
      });
      setText("");
      void refresh();
    },
  });
  const clear = useMutation({
    mutationFn: () => getAdminLibraryApi().clearAnswerKey(book.id),
    onSuccess: () => {
      setConfirmClear(false);
      toast({ variant: "success", title: t("cleared") });
      void refresh();
    },
  });

  const lineErrors = keyErrors(save.error);
  const singleCode = keyErrorCode(save.error);
  const total = key.data?.length ?? 0;

  if (book.page_count === 0) {
    return (
      <section aria-labelledby="library-key" className={CARD}>
        <h2 id="library-key" className="font-semibold">
          {t("title")}
        </h2>
        <p className="text-muted text-sm">{t("needFile")}</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="library-key" className={CARD}>
      <h2 id="library-key" className="font-semibold">
        {t("title")}
      </h2>
      <p className="text-muted text-sm" aria-live="polite">
        {key.isPending ? t("loading") : t("count", { count: total })}
      </p>

      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("inputLabel")}
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={7}
          spellCheck={false}
          placeholder={t("placeholder")}
          aria-describedby="library-key-help"
          className="border-border bg-surface min-h-32 resize-y rounded-lg border p-3 font-mono text-sm font-normal"
        />
      </label>
      <p id="library-key-help" className="text-muted text-xs">
        {t("help", { pages: book.page_count })}
      </p>

      <fieldset className="flex flex-col gap-1 text-sm">
        <legend className="sr-only">{t("modeLabel")}</legend>
        {(["replace", "merge"] as const).map((value) => (
          <label key={value} className="flex min-h-9 items-center gap-2">
            <input
              type="radio"
              name="answer-key-mode"
              checked={mode === value}
              onChange={() => setMode(value)}
            />
            {t(`mode.${value}`)}
          </label>
        ))}
      </fieldset>

      {save.isError && (
        <div role="alert" className="text-danger flex flex-col gap-1 text-sm">
          {lineErrors.length > 0 ? (
            <>
              <p className="font-medium">{t("errors.lines", { count: lineErrors.length })}</p>
              <ul className="list-disc pl-5">
                {lineErrors.slice(0, MAX_SHOWN_ERRORS).map((item) => (
                  <li key={`${item.line}:${item.code}`}>
                    {t("errors.line", {
                      line: item.line,
                      reason: t.has(`errors.codes.${item.code}`)
                        ? t(`errors.codes.${item.code}`)
                        : t("errors.codes.invalid_line"),
                    })}
                  </li>
                ))}
              </ul>
              {lineErrors.length > MAX_SHOWN_ERRORS && (
                <p>{t("errors.more", { count: lineErrors.length - MAX_SHOWN_ERRORS })}</p>
              )}
            </>
          ) : singleCode && t.has(`errors.codes.${singleCode}`) ? (
            <p>{t(`errors.codes.${singleCode}`)}</p>
          ) : (
            <p>{errorText(save.error)}</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => save.mutate()}
          loading={save.isPending}
          disabled={text.trim() === ""}
          size="sm"
        >
          {t("save")}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={total === 0}
          onClick={() => setText(keyToText(key.data ?? []))}
        >
          {t("load")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-danger ml-auto"
          disabled={total === 0}
          onClick={() => setConfirmClear(true)}
        >
          {t("clear")}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title={t("clearTitle")}
        description={t("clearDescription")}
        confirmLabel={t("clearConfirm")}
        onConfirm={() => clear.mutate()}
        pending={clear.isPending}
        error={clear.isError ? errorText(clear.error) : undefined}
      />
    </section>
  );
}
