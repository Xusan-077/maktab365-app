"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { yupResolver } from "@hookform/resolvers/yup";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Check,
  CloudUpload,
  Loader2,
  Monitor,
  Plus,
  RefreshCw,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  Controller,
  FormProvider,
  useFieldArray,
  useForm,
  useWatch,
  type Resolver,
} from "react-hook-form";
import { SummaryBlocks } from "@/components/topic/SummaryBlocks";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Popover } from "@/components/ui/Popover";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useToast } from "@/hooks/useToast";
import type { Locale } from "@/lib/i18n/config";
import { getTopicMaterialsApi } from "@/lib/topic-materials/api";
import { emptyBlock, hasContent, SUMMARY_BLOCK_TYPES } from "@/lib/topic-materials/blocks";
import { topicKeys, topicQueries } from "@/lib/topic-materials/queries";
import type {
  SummaryBlock,
  SummaryBlockType,
  SummaryInput,
  SummaryStatus,
  TopicSummary,
} from "@/lib/topic-materials/types";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/format-date";
import { SUMMARY_LIMITS, summarySchema } from "@/lib/validation/topic-materials";
import { ConfirmDialog } from "../ConfirmDialog";
import { QueryError } from "../QueryError";
import { useAdminErrorText } from "../useAdminErrorText";
import { BLOCK_ICONS, SummaryBlockCard } from "./SummaryBlockCard";

/** Oxirgi tahrirdan shuncha ms keyin avtosaqlanadi. */
export const AUTOSAVE_MS = 1000;

type Device = "desktop" | "mobile";
type Blocked = { json: string; reason: "invalid" | "error" };

const serialize = (value: Partial<SummaryInput>) =>
  JSON.stringify({ status: value.status, blocks: value.blocks ?? [] });

/**
 * Nashrda bo'sh maydonlar xato (`$published`), qoralamada — yo'q. Kontekst qiymatlardan olinadi:
 * holat almashganda resolver yangilanmay qolmaydi. `raw` — saqlanadigan qiymat formadagi bilan bir xil.
 */
const schemaResolver = yupResolver(summarySchema, undefined, {
  raw: true,
}) as unknown as Resolver<SummaryInput>;
const resolver: Resolver<SummaryInput> = (values, context, options) =>
  schemaResolver(values, { ...(context ?? {}), published: values.status === "published" }, options);

function AddBlockMenu({
  disabled,
  onAdd,
}: {
  disabled?: boolean;
  onAdd: (type: SummaryBlockType) => void;
}) {
  const t = useTranslations("admin.topic.summary");
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      label={t("addBlock")}
      align="start"
      side="top"
      className="w-80 p-2"
      trigger={(props) => (
        <Button variant="secondary" disabled={disabled} data-testid="summary-add-block" {...props}>
          <Plus className="size-4" aria-hidden />
          {t("addBlock")}
        </Button>
      )}
    >
      <ul className="flex flex-col">
        {SUMMARY_BLOCK_TYPES.map((type) => {
          const Icon = BLOCK_ICONS[type];
          return (
            <li key={type}>
              <button
                type="button"
                data-testid={`summary-add-${type}`}
                className="hover:bg-ds-canvas rounded-ds-sm flex min-h-11 w-full items-start gap-3 p-2.5 text-left"
                onClick={() => {
                  onAdd(type);
                  setOpen(false);
                }}
              >
                <Icon className="text-ds-accent mt-0.5 size-5 shrink-0" aria-hidden />
                <span className="flex flex-col">
                  <span className="text-ds-ink text-sm font-semibold">
                    {t(`types.${type}.title`)}
                  </span>
                  <span className="text-ds-muted text-xs">{t(`types.${type}.hint`)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Popover>
  );
}

function SaveIndicator({
  state,
  updatedAt,
  onRetry,
}: {
  state: "saved" | "unsaved" | "saving" | Blocked["reason"];
  updatedAt: string | null;
  onRetry: () => void;
}) {
  const t = useTranslations("admin.topic.summary.save");
  const locale = useLocale() as Locale;
  const icon = {
    saved: <Check className="text-success size-4" aria-hidden />,
    unsaved: <CloudUpload className="text-muted size-4" aria-hidden />,
    saving: <Loader2 className="text-muted size-4 animate-spin" aria-hidden />,
    invalid: <AlertCircle className="text-danger size-4" aria-hidden />,
    error: <AlertCircle className="text-danger size-4" aria-hidden />,
  }[state];
  const text =
    state === "saved"
      ? updatedAt
        ? t("savedAt", { date: formatDate(updatedAt, locale, "dateTime") })
        : t("empty")
      : t(state);
  return (
    <div
      className="flex items-center gap-2 text-sm"
      data-testid="summary-save-state"
      data-state={state}
    >
      <p role="status" aria-live="polite" className="text-muted flex items-center gap-1.5">
        {icon}
        <span className={cn((state === "invalid" || state === "error") && "text-danger")}>
          {text}
        </span>
      </p>
      {state === "error" && (
        <Button variant="ghost" size="sm" onClick={onRetry}>
          <RefreshCw className="size-4" aria-hidden />
          {t("retry")}
        </Button>
      )}
    </div>
  );
}

function SummaryPreview({ blocks, published }: { blocks: SummaryBlock[]; published: boolean }) {
  const t = useTranslations("admin.topic.summary.preview");
  const tt = useTranslations("topic");
  const [device, setDevice] = useState<Device>("desktop");
  const visible = blocks.filter(hasContent);
  return (
    <section aria-labelledby="summary-preview-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="summary-preview-title" className="text-foreground text-base font-semibold">
          {t("title")}
        </h2>
        <SegmentedControl
          legend={t("device")}
          hideLegend
          value={device}
          onChange={setDevice}
          options={[
            {
              value: "desktop",
              label: t("desktop"),
              icon: <Monitor className="size-4" aria-hidden />,
              testId: "summary-preview-desktop",
            },
            {
              value: "mobile",
              label: t("mobile"),
              icon: <Smartphone className="size-4" aria-hidden />,
              testId: "summary-preview-mobile",
            },
          ]}
        />
      </div>
      <div className="bg-ds-canvas rounded-ds-lg flex justify-center p-3 sm:p-4">
        <div
          data-testid="summary-preview"
          data-device={device}
          className={cn(
            "bg-ds-surface text-ds-ink border-ds-line rounded-ds-lg w-full border p-4 shadow-sm transition-[max-width] duration-200",
            device === "desktop" ? "max-w-[30rem]" : "max-w-[22.5rem]",
          )}
        >
          <p className="font-ui mb-3 flex items-center gap-2 text-sm font-bold">
            {tt("tabs.summary")}
            {published && (
              <span className="bg-ds-ok-bg text-ds-ok-ink rounded-full px-2 py-0.5 text-xs font-semibold">
                {tt("verified")}
              </span>
            )}
          </p>
          {visible.length > 0 ? (
            <SummaryBlocks blocks={visible} />
          ) : (
            <p className="text-ds-muted text-sm">{t("empty")}</p>
          )}
        </div>
      </div>
    </section>
  );
}

function SummaryForm({ topicId, initial }: { topicId: string; initial: TopicSummary | null }) {
  const t = useTranslations("admin.topic.summary");
  const tc = useTranslations("admin.common");
  const queryClient = useQueryClient();
  const errorText = useAdminErrorText();
  const { toast } = useToast();
  const form = useForm<SummaryInput>({
    defaultValues: { status: initial?.status ?? "draft", blocks: initial?.blocks ?? [] },
    resolver,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const { control, handleSubmit, getValues, setValue } = form;
  const { fields, append, remove, move, replace } = useFieldArray({ control, name: "blocks" });
  const values = useWatch({ control }) as Partial<SummaryInput>;
  const blocks = (values.blocks ?? []) as SummaryBlock[];
  const status: SummaryStatus = values.status ?? "draft";

  const json = serialize(values);
  const debounced = useDebouncedValue(json, AUTOSAVE_MS);
  const [saved, setSaved] = useState(() => serialize(getValues()));
  const [updatedAt, setUpdatedAt] = useState(initial?.updated_at ?? null);
  const [blocked, setBlocked] = useState<Blocked | null>(null);
  const [aiBlocks, setAiBlocks] = useState<SummaryBlock[] | null>(null);
  const [removeIndex, setRemoveIndex] = useState<number | null>(null);

  const save = useMutation({
    mutationFn: ({ input }: { input: SummaryInput; json: string }) =>
      getTopicMaterialsApi().saveSummary(topicId, input),
    onSuccess: (data, { json: savedJson }) => {
      setSaved(savedJson);
      setUpdatedAt(data.updated_at);
      queryClient.setQueryData(topicKeys.summary(topicId), data);
    },
    onError: (_error, { json: failedJson }) => setBlocked({ json: failedJson, reason: "error" }),
  });

  const submit = useCallback(
    (target: string) =>
      handleSubmit(
        (input) => save.mutate({ input, json: serialize(input) }),
        () => setBlocked({ json: target, reason: "invalid" }),
      )(),
    [handleSubmit, save],
  );

  useEffect(() => {
    if (save.isPending || debounced === saved || blocked?.json === debounced) return;
    void submit(debounced);
  }, [debounced, saved, blocked, save.isPending, submit]);

  // Tab almashsa yoki sahifadan chiqilsa (1 s kutmasdan) — oxirgi yaroqli holat saqlanadi.
  const latest = useRef({ json, saved });
  useEffect(() => {
    latest.current = { json, saved };
  });
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (latest.current.json !== latest.current.saved) event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      const { json: pending, saved: done } = latest.current;
      if (pending === done) return;
      const input = JSON.parse(pending) as SummaryInput;
      const context = { published: input.status === "published" };
      if (!summarySchema.isValidSync(input, { context })) return;
      void getTopicMaterialsApi()
        .saveSummary(topicId, input)
        .then((data) => queryClient.setQueryData(topicKeys.summary(topicId), data))
        .catch(() => undefined);
    };
  }, [topicId, queryClient]);

  const ai = useMutation({
    mutationFn: () => getTopicMaterialsApi().aiDraft(topicId),
    onSuccess: (draft) => {
      if (draft.length === 0) {
        toast({ variant: "error", title: t("ai.empty") });
      } else if (getValues("blocks").some(hasContent)) {
        setAiBlocks(draft);
      } else {
        applyAi(draft);
      }
    },
    onError: (error) => toast({ variant: "error", title: errorText(error) }),
  });

  function applyAi(draft: SummaryBlock[]) {
    replace(draft.slice(0, SUMMARY_LIMITS.blocks));
    // AI natijasi o'quvchiga chiqmasin: ustoz tekshirib nashr qiladi.
    setValue("status", "draft");
    setAiBlocks(null);
    toast({ variant: "success", title: t("ai.applied") });
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const position = (id: string | number) => fields.findIndex((field) => field.id === id) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) => t("dnd.pickedUp", { n: position(active.id) }),
    onDragOver: ({ active, over }) =>
      over ? t("dnd.over", { n: position(active.id), to: position(over.id) }) : undefined,
    onDragEnd: ({ active, over }) =>
      over ? t("dnd.dropped", { n: position(active.id), to: position(over.id) }) : undefined,
    onDragCancel: ({ active }) => t("dnd.cancelled", { n: position(active.id) }),
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    move(position(active.id) - 1, position(over.id) - 1);
  };

  const saveState = save.isPending
    ? "saving"
    : blocked?.json === json
      ? blocked.reason
      : json !== saved
        ? "unsaved"
        : "saved";

  const full = fields.length >= SUMMARY_LIMITS.blocks;

  return (
    <FormProvider {...form}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,32rem)]">
        <form
          noValidate
          aria-label={t("formLabel")}
          className="flex min-w-0 flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            setBlocked(null);
          }}
        >
          <div className="border-border bg-surface rounded-ds flex flex-wrap items-center gap-3 border p-3">
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <SegmentedControl
                  legend={t("status")}
                  hideLegend
                  value={field.value}
                  onChange={field.onChange}
                  options={[
                    { value: "draft", label: t("statuses.draft"), testId: "summary-status-draft" },
                    {
                      value: "published",
                      label: t("statuses.published"),
                      testId: "summary-status-published",
                    },
                  ]}
                />
              )}
            />
            <Badge
              variant={status === "published" ? "success" : "neutral"}
              className="max-sm:hidden"
            >
              {status === "published" ? t("visibleToStudents") : t("hiddenFromStudents")}
            </Badge>
            <div className="ml-auto">
              <SaveIndicator
                state={saveState}
                updatedAt={updatedAt}
                onRetry={() => setBlocked(null)}
              />
            </div>
          </div>

          {fields.length === 0 ? (
            <EmptyState icon={Sparkles}>{t("empty")}</EmptyState>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
              accessibility={{
                announcements,
                screenReaderInstructions: { draggable: t("dnd.instructions") },
              }}
            >
              <SortableContext
                items={fields.map((field) => field.id)}
                strategy={verticalListSortingStrategy}
              >
                <ol className="flex flex-col gap-3" aria-label={t("blocksLabel")}>
                  {fields.map((field, index) => (
                    <SummaryBlockCard
                      key={field.id}
                      id={field.id}
                      index={index}
                      type={field.type}
                      onRemove={() =>
                        blocks[index] && hasContent(blocks[index])
                          ? setRemoveIndex(index)
                          : remove(index)
                      }
                    />
                  ))}
                </ol>
              </SortableContext>
            </DndContext>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <AddBlockMenu disabled={full} onAdd={(type) => append(emptyBlock(type))} />
            <Button
              variant="ghost"
              loading={ai.isPending}
              onClick={() => ai.mutate()}
              data-testid="summary-ai"
            >
              {!ai.isPending && <Sparkles className="size-4" aria-hidden />}
              {t("ai.button")}
            </Button>
            {full && (
              <p className="text-muted text-sm">{t("full", { max: SUMMARY_LIMITS.blocks })}</p>
            )}
          </div>
          <p className="text-muted text-xs">{t("ai.hint")}</p>
        </form>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <SummaryPreview blocks={blocks} published={status === "published"} />
        </div>
      </div>

      <ConfirmDialog
        open={aiBlocks !== null}
        onOpenChange={(open) => !open && setAiBlocks(null)}
        title={t("ai.replaceTitle")}
        description={t("ai.replaceDescription")}
        confirmLabel={t("ai.replace")}
        onConfirm={() => aiBlocks && applyAi(aiBlocks)}
      />
      <ConfirmDialog
        open={removeIndex !== null}
        onOpenChange={(open) => !open && setRemoveIndex(null)}
        title={t("removeTitle")}
        description={t("removeDescription", { n: (removeIndex ?? 0) + 1 })}
        confirmLabel={tc("delete")}
        onConfirm={() => {
          if (removeIndex !== null) remove(removeIndex);
          setRemoveIndex(null);
        }}
      />
    </FormProvider>
  );
}

/** Admin «Xulosa»: tipli bloklar muharriri, avtosaqlash (1 s), AI qoralamasi, jonli ko'rinish. */
export function SummaryEditor({ topicId }: { topicId: string }) {
  const summary = useQuery(topicQueries.summary(topicId));
  if (summary.error)
    return <QueryError error={summary.error} onRetry={() => void summary.refetch()} />;
  if (summary.isPending) return <Skeleton className="h-96" />;
  return <SummaryForm topicId={topicId} initial={summary.data} />;
}
