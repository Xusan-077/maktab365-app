"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, ListPlus, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { AnimatePresence, m } from "@/components/ui/motion";
import { Textarea } from "@/components/ui/Textarea";
import {
  CHAPTER_TITLE_MAX,
  chapterProblems,
  countRows,
  emptyDraft,
  emptyRow,
  moveItem,
  parseBulk,
  withoutBlankRows,
  type ChapterDraft,
  type ChapterRow,
  type RowProblem,
} from "@/lib/admin/chapters";
import { cn } from "@/lib/utils/cn";

const iconButton =
  "text-muted hover:bg-subtle hover:text-foreground inline-flex size-11 shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent sm:size-10";
const inputClasses =
  "border-border bg-surface text-foreground placeholder:text-muted hover:border-primary-300 aria-[invalid=true]:border-danger h-11 min-w-0 rounded-lg border px-3 text-sm shadow-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:h-10";

export interface ChaptersEditorProps {
  value: ChapterDraft[];
  onChange: (next: ChapterDraft[]) => void;
  /** PDF betlari soni (ma'lum bo'lsa, undan katta bet xato). */
  pageCount?: number;
  disabled?: boolean;
  /** `true` — to'ldirilmagan/noto'g'ri qatorlar xatosi ko'rsatiladi (yuborishga urinishdan keyin). */
  showProblems?: boolean;
}

interface RowFieldsProps {
  row: ChapterRow;
  position: string;
  problem: RowProblem | undefined;
  pageCount?: number;
  disabled?: boolean;
  onChange: (patch: Partial<ChapterRow>) => void;
  actions: ReactNode;
  nested?: boolean;
}

function RowFields({
  row,
  position,
  problem,
  pageCount,
  disabled,
  onChange,
  actions,
  nested,
}: RowFieldsProps) {
  const t = useTranslations("admin.toc");
  const errorId = `${row.key}-error`;
  return (
    <div className={cn("flex flex-col gap-1", nested && "border-border ml-4 border-l pl-3")}>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={row.title}
          disabled={disabled}
          maxLength={CHAPTER_TITLE_MAX + 20}
          aria-label={t("titleLabel", { n: position })}
          placeholder={t("titlePlaceholder")}
          aria-invalid={problem === "titleRequired" || problem === "titleTooLong" || undefined}
          aria-describedby={problem ? errorId : undefined}
          autoComplete="off"
          data-testid="toc-title"
          onChange={(event) => onChange({ title: event.target.value })}
          className={cn(inputClasses, "min-w-40 flex-1")}
        />
        <input
          value={row.page}
          disabled={disabled}
          inputMode="numeric"
          aria-label={t("pageLabel", { n: position })}
          placeholder={t("pagePlaceholder")}
          aria-invalid={problem === "pageInvalid" || problem === "pageExceeds" || undefined}
          aria-describedby={problem ? errorId : undefined}
          autoComplete="off"
          data-testid="toc-page"
          onChange={(event) => onChange({ page: event.target.value.replace(/\D/g, "") })}
          className={cn(inputClasses, "w-20 text-center tabular-nums")}
        />
        <div className="flex">{actions}</div>
      </div>
      {problem && (
        <p id={errorId} role="alert" className="text-danger text-sm">
          {t(`problems.${problem}`, { pages: pageCount ?? 0 })}
        </p>
      )}
    </div>
  );
}

function BulkInput({
  onApply,
  disabled,
}: {
  onApply: (rows: ChapterDraft[]) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("admin.toc.bulk");
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ added: number; skipped: number } | null>(null);

  function apply() {
    const { rows, skipped } = parseBulk(text);
    if (rows.length > 0) {
      onApply(rows);
      setText("");
    }
    setResult({ added: countRows(rows), skipped });
  }

  return (
    <details className="border-border bg-subtle/40 rounded-lg border p-3" data-testid="toc-bulk">
      <summary className="min-h-11 cursor-pointer text-sm font-medium select-none sm:min-h-0">
        {t("title")}
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        <Textarea
          aria-label={t("title")}
          hint={t("hint")}
          placeholder={t("placeholder")}
          rows={6}
          value={text}
          disabled={disabled}
          onChange={(event) => {
            setText(event.target.value);
            setResult(null);
          }}
          className="font-mono text-xs"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" disabled={disabled || !text.trim()} onClick={apply}>
            <ListPlus className="size-4" aria-hidden />
            {t("apply")}
          </Button>
          <p className="text-muted text-sm" role="status" aria-live="polite">
            {result &&
              [
                result.added > 0 ? t("added", { count: result.added }) : null,
                result.skipped > 0 ? t("skipped", { count: result.skipped }) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
          </p>
        </div>
      </div>
    </details>
  );
}

/**
 * Mundarija muharriri: qatorlar (sarlavha + bet), 2 darajali ichma-ich bo'limlar, tartibni yuqoriga/
 * pastga surish va "Ommaviy kiritish". Holat tashqarida (`value`), yuborishda `toPayload` ishlatiladi.
 */
export function ChaptersEditor({
  value,
  onChange,
  pageCount,
  disabled,
  showProblems,
}: ChaptersEditorProps) {
  const t = useTranslations("admin.toc");
  const problems = showProblems ? chapterProblems(value, pageCount) : new Map<string, RowProblem>();
  const set = (next: ChapterDraft[]) => onChange(next);

  const patchTop = (index: number, patch: Partial<ChapterRow>) =>
    set(value.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)));
  const patchChild = (index: number, childIndex: number, patch: Partial<ChapterRow>) =>
    set(
      value.map((draft, i) =>
        i === index
          ? {
              ...draft,
              children: draft.children.map((child, j) =>
                j === childIndex ? { ...child, ...patch } : child,
              ),
            }
          : draft,
      ),
    );
  const addChild = (index: number) =>
    set(
      value.map((draft, i) =>
        i === index ? { ...draft, children: [...draft.children, emptyRow()] } : draft,
      ),
    );
  const removeChild = (index: number, childIndex: number) =>
    set(
      value.map((draft, i) =>
        i === index
          ? { ...draft, children: draft.children.filter((_, j) => j !== childIndex) }
          : draft,
      ),
    );
  const moveChild = (index: number, childIndex: number, delta: -1 | 1) =>
    set(
      value.map((draft, i) =>
        i === index ? { ...draft, children: moveItem(draft.children, childIndex, delta) } : draft,
      ),
    );
  const applyBulk = (rows: ChapterDraft[]) => set([...withoutBlankRows(value), ...rows]);

  return (
    <section className="flex flex-col gap-3" aria-labelledby="toc-heading" data-testid="toc-editor">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="toc-heading" className="text-foreground text-sm font-medium">
          {t("title")}
        </h3>
        <span className="text-muted text-xs">{t("count", { count: countRows(value) })}</span>
      </div>
      <p className="text-muted -mt-2 text-sm">{t("hint")}</p>

      {value.length === 0 ? (
        <p className="border-border text-muted rounded-lg border border-dashed p-4 text-center text-sm">
          {t("empty")}
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {value.map((draft, index) => (
              <m.li
                key={draft.key}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
                data-testid="toc-row"
                className="border-border bg-surface flex flex-col gap-2 rounded-xl border p-3"
              >
                <RowFields
                  row={draft}
                  position={String(index + 1)}
                  problem={problems.get(draft.key)}
                  pageCount={pageCount}
                  disabled={disabled}
                  onChange={(patch) => patchTop(index, patch)}
                  actions={
                    <>
                      <button
                        type="button"
                        className={iconButton}
                        disabled={disabled || index === 0}
                        aria-label={t("moveUp", { n: index + 1 })}
                        onClick={() => set(moveItem(value, index, -1))}
                      >
                        <ChevronUp className="size-5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        className={iconButton}
                        disabled={disabled || index === value.length - 1}
                        aria-label={t("moveDown", { n: index + 1 })}
                        onClick={() => set(moveItem(value, index, 1))}
                      >
                        <ChevronDown className="size-5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        className={iconButton}
                        disabled={disabled}
                        aria-label={t("addChildFor", { n: index + 1 })}
                        title={t("addChild")}
                        onClick={() => addChild(index)}
                      >
                        <ListPlus className="size-5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        className={cn(iconButton, "hover:text-danger")}
                        disabled={disabled}
                        aria-label={t("remove", { n: index + 1 })}
                        onClick={() => set(value.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="size-5" aria-hidden />
                      </button>
                    </>
                  }
                />
                {draft.children.map((child, childIndex) => (
                  <RowFields
                    key={child.key}
                    nested
                    row={child}
                    position={`${index + 1}.${childIndex + 1}`}
                    problem={problems.get(child.key)}
                    pageCount={pageCount}
                    disabled={disabled}
                    onChange={(patch) => patchChild(index, childIndex, patch)}
                    actions={
                      <>
                        <button
                          type="button"
                          className={iconButton}
                          disabled={disabled || childIndex === 0}
                          aria-label={t("moveUp", { n: `${index + 1}.${childIndex + 1}` })}
                          onClick={() => moveChild(index, childIndex, -1)}
                        >
                          <ChevronUp className="size-5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          className={iconButton}
                          disabled={disabled || childIndex === draft.children.length - 1}
                          aria-label={t("moveDown", { n: `${index + 1}.${childIndex + 1}` })}
                          onClick={() => moveChild(index, childIndex, 1)}
                        >
                          <ChevronDown className="size-5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          className={cn(iconButton, "hover:text-danger")}
                          disabled={disabled}
                          aria-label={t("remove", { n: `${index + 1}.${childIndex + 1}` })}
                          onClick={() => removeChild(index, childIndex)}
                        >
                          <Trash2 className="size-5" aria-hidden />
                        </button>
                      </>
                    }
                  />
                ))}
              </m.li>
            ))}
          </AnimatePresence>
        </ol>
      )}

      <div>
        <Button
          variant="secondary"
          disabled={disabled || countRows(value) >= 500}
          data-testid="toc-add"
          onClick={() => set([...value, emptyDraft()])}
        >
          <Plus className="size-4" aria-hidden />
          {t("add")}
        </Button>
      </div>

      <BulkInput onApply={applyBulk} disabled={disabled} />
    </section>
  );
}
