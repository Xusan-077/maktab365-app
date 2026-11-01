"use client";

import type { ReactNode } from "react";
import { RotateCw, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { usePageNote } from "@/hooks/usePageNote";
import { NOTE_MAX_LENGTH } from "@/lib/books/annotations";
import { BK_ICON_BUTTON, withKey } from "../reader-styles";
import { cn } from "@/lib/utils/cn";
import { SaveStatus } from "./SaveStatus";

export interface NotesTab {
  id: string;
  label: string;
  content: ReactNode;
}

export const NOTE_TAB = "note";

export interface NotesPanelProps {
  bookId: string;
  page: number;
  signedIn: boolean;
  /** Mehmon matn yozmoqchi bo'lsa: kirish taklifi. */
  onRequireAuth: () => void;
  onRetrySave: () => void;
  /** Panelni yopish tugmasi (mobil sheet o'zining tutqichiga ega). */
  onClose?: () => void;
  /** Maxsus rejim bo'limlari (yechimlar, javoblar varag'i): «Yozuv» yonida tablar sifatida. */
  tabs?: readonly NotesTab[];
  tab?: string;
  onTabChange?: (id: string) => void;
}

function NoteEditor({
  bookId,
  page,
  signedIn,
  onRequireAuth,
}: Pick<NotesPanelProps, "bookId" | "page" | "signedIn" | "onRequireAuth">) {
  const t = useTranslations("books.workspace.notes");
  const note = usePageNote(bookId, page);

  if (note.error) {
    return (
      <div
        role="alert"
        className="text-bk-muted flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm"
      >
        {t("loadError")}
        <Button variant="secondary" size="sm" onClick={note.retry}>
          <RotateCw className="size-4" aria-hidden />
          {t("retry")}
        </Button>
      </div>
    );
  }

  if (!note.ready) {
    return (
      <div role="status" aria-label={t("loading")} className="flex flex-col gap-2 p-4">
        <div className="bg-bk-line/60 h-4 w-3/4 animate-pulse rounded motion-reduce:animate-none" />
        <div className="bg-bk-line/60 h-4 w-full animate-pulse rounded motion-reduce:animate-none" />
        <div className="bg-bk-line/60 h-4 w-1/2 animate-pulse rounded motion-reduce:animate-none" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <textarea
        value={note.text}
        onChange={(event) => note.setText(event.target.value)}
        onFocus={() => {
          if (!signedIn) onRequireAuth();
        }}
        readOnly={!signedIn}
        maxLength={NOTE_MAX_LENGTH}
        aria-label={t("label", { page })}
        placeholder={signedIn ? t("placeholder") : t("guestPlaceholder")}
        spellCheck
        className="text-bk-ink placeholder:text-bk-muted min-h-0 flex-1 resize-none bg-transparent p-4 text-[0.9375rem] leading-relaxed outline-none"
      />
    </div>
  );
}

/** Betning yon daftari: matn har bet uchun alohida, o'zi saqlanadi. */
export function NotesPanel({
  bookId,
  page,
  signedIn,
  onRequireAuth,
  onRetrySave,
  onClose,
  tabs = [],
  tab = NOTE_TAB,
  onTabChange,
}: NotesPanelProps) {
  const t = useTranslations("books.workspace.notes");
  const keys = useTranslations("books.workspace.keys");
  const extra = tabs.find((item) => item.id === tab);
  const allTabs: NotesTab[] = [{ id: NOTE_TAB, label: t("tab"), content: null }, ...tabs];

  return (
    <section aria-label={t("title")} className="bg-bk-bar text-bk-ink flex min-h-0 flex-1 flex-col">
      <header className="border-bk-line flex min-h-12 items-center gap-2 border-b pr-1 pl-4">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm leading-tight font-semibold">{t("heading", { page })}</h2>
          <SaveStatus onRetry={onRetrySave} className="min-h-4" />
        </div>
        {onClose && (
          <button
            type="button"
            className={BK_ICON_BUTTON}
            onClick={onClose}
            aria-label={t("close")}
            title={withKey(t("close"), keys("notes"))}
          >
            <X className="size-5" aria-hidden />
          </button>
        )}
      </header>
      {tabs.length > 0 && (
        <div
          role="tablist"
          aria-label={t("tabs")}
          className="border-bk-line flex gap-1 border-b px-2 py-1"
        >
          {allTabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`notes-tab-${item.id}`}
              aria-selected={(extra?.id ?? NOTE_TAB) === item.id}
              aria-controls="notes-tabpanel"
              onClick={() => onTabChange?.(item.id)}
              className={cn(
                "h-9 rounded-lg px-3 text-sm font-medium transition-colors",
                (extra?.id ?? NOTE_TAB) === item.id
                  ? "bg-bk-accent-soft text-bk-accent"
                  : "text-bk-muted hover:bg-bk-accent-soft",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
      <div
        id="notes-tabpanel"
        role={tabs.length > 0 ? "tabpanel" : undefined}
        aria-labelledby={tabs.length > 0 ? `notes-tab-${extra?.id ?? NOTE_TAB}` : undefined}
        className="flex min-h-0 flex-1 flex-col"
      >
        {extra ? (
          extra.content
        ) : (
          <NoteEditor
            key={page}
            bookId={bookId}
            page={page}
            signedIn={signedIn}
            onRequireAuth={onRequireAuth}
          />
        )}
      </div>
    </section>
  );
}
