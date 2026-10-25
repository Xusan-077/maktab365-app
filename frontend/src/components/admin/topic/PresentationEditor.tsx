"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
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
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { yupResolver } from "@hookform/resolvers/yup";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { EyeOff, FileUp, GripVertical, Loader2, RefreshCw, X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Controller,
  get,
  useFieldArray,
  useForm,
  useWatch,
  type FieldErrors,
  type Resolver,
} from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/hooks/useToast";
import { getTopicMaterialsApi } from "@/lib/topic-materials/api";
import { CONVERSION_POLL_MS, topicKeys, topicQueries } from "@/lib/topic-materials/queries";
import {
  PRESENTATION_ACCEPT,
  PRESENTATION_MAX_BYTES,
  presentationFileProblem,
  sortSlides,
  toSlidePatches,
  type PresentationFileProblem,
} from "@/lib/topic-materials/slides";
import type { Presentation, Slide } from "@/lib/topic-materials/types";
import { formatBytes } from "@/lib/utils/bytes";
import { cn } from "@/lib/utils/cn";
import { SLIDE_LIMITS, slidesSchema } from "@/lib/validation/topic-materials";
import { QueryError } from "../QueryError";
import { useAdminErrorText } from "../useAdminErrorText";

type Phase = "idle" | "uploading" | "converting" | "error" | "failed";

interface SlideValue {
  id: string;
  alt: string;
  note: string | null;
  hidden: boolean;
}
interface SlidesValues {
  slides: SlideValue[];
}

const slidesResolver = yupResolver(slidesSchema) as unknown as Resolver<SlidesValues>;

function UploadZone({ topicId, hasPresentation }: { topicId: string; hasPresentation: boolean }) {
  const t = useTranslations("admin.topic.slides");
  const queryClient = useQueryClient();
  const errorText = useAdminErrorText();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [problem, setProblem] = useState<PresentationFileProblem | null>(null);
  const [uploadError, setUploadError] = useState<unknown>(null);
  const [over, setOver] = useState(false);

  const [conversion, setConversion] = useState(0);

  // Sahifadan chiqilsa yuklash va polling to'xtaydi (server konvertatsiyani davom ettiradi).
  useEffect(() => () => controller.current?.abort(), []);

  /** Konvertatsiya holatini `CONVERSION_POLL_MS` da so'raydi: `ready` → taqdimot qayta o'qiladi. */
  async function poll(signal: AbortSignal) {
    const api = getTopicMaterialsApi();
    while (!signal.aborted) {
      const state = await api.conversionStatus(topicId);
      if (signal.aborted) return;
      setConversion(state.progress);
      if (state.status === "ready") {
        setPhase("idle");
        setFile(null);
        await queryClient.invalidateQueries({ queryKey: topicKeys.presentation(topicId) });
        toast({ variant: "success", title: t("ready") });
        return;
      }
      if (state.status === "failed") {
        setPhase("failed");
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, CONVERSION_POLL_MS));
    }
  }

  async function start(chosen: File) {
    controller.current?.abort();
    controller.current = new AbortController();
    const { signal } = controller.current;
    setFile(chosen);
    setPhase("uploading");
    setProgress(0);
    setUploadError(null);
    try {
      await getTopicMaterialsApi().uploadPresentation(topicId, chosen, {
        signal,
        onProgress: setProgress,
      });
      setConversion(0);
      setPhase("converting");
      await poll(signal);
    } catch (error) {
      if (signal.aborted) return;
      if (error instanceof DOMException && error.name === "AbortError") {
        setPhase("idle");
        setFile(null);
        return;
      }
      setUploadError(error);
      setPhase("error");
    }
  }

  function choose(chosen: File | undefined) {
    if (!chosen) return;
    const found = presentationFileProblem(chosen);
    setProblem(found);
    if (!found) void start(chosen);
  }

  const busy = phase === "uploading" || phase === "converting";
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setOver(false);
    if (!busy) choose(event.dataTransfer.files[0]);
  };

  return (
    <section aria-labelledby="slides-upload-title" className="flex flex-col gap-3">
      <h2 id="slides-upload-title" className="text-foreground text-base font-semibold">
        {hasPresentation ? t("replaceTitle") : t("uploadTitle")}
      </h2>
      <div
        data-testid="slides-dropzone"
        data-over={over || undefined}
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={cn(
          "border-border bg-surface rounded-ds-lg flex flex-col items-center gap-3 border-2 border-dashed p-6 text-center transition-colors",
          over && "border-ds-accent bg-ds-accent-tint",
        )}
      >
        <FileUp className="text-ds-accent size-8" aria-hidden />
        <p className="text-foreground text-sm font-medium">{t("dropHint")}</p>
        <p className="text-muted text-xs">
          {t("limits", { size: formatBytes(PRESENTATION_MAX_BYTES) })}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={PRESENTATION_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-label={t("choose")}
          data-testid="slides-file-input"
          disabled={busy}
          onChange={(event) => {
            const chosen = event.target.files?.[0];
            event.target.value = "";
            choose(chosen);
          }}
        />
        <Button variant="secondary" disabled={busy} onClick={() => inputRef.current?.click()}>
          {t("chooseButton")}
        </Button>
        {hasPresentation && !busy && <p className="text-muted text-xs">{t("replaceHint")}</p>}
      </div>

      {problem && (
        <p role="alert" className="text-danger text-sm" data-testid="slides-problem">
          {t(`problems.${problem}`, { size: formatBytes(PRESENTATION_MAX_BYTES) })}
        </p>
      )}

      {phase === "uploading" && (
        <div role="status" className="flex flex-col gap-1.5" data-testid="slides-uploading">
          <p className="text-muted text-xs">
            {file?.name} · {t("uploading")}
          </p>
          <div className="flex items-center gap-3">
            <ProgressBar
              className="flex-1"
              value={Math.round(progress * 100)}
              label={t("uploadProgress")}
              showValue
            />
            <Button variant="secondary" size="sm" onClick={() => controller.current?.abort()}>
              <X className="size-4" aria-hidden />
              {t("cancel")}
            </Button>
          </div>
        </div>
      )}

      {phase === "converting" && (
        <div role="status" className="flex flex-col gap-1.5" data-testid="slides-converting">
          <p className="text-muted flex items-center gap-1.5 text-xs">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            {t("converting")}
          </p>
          <ProgressBar value={conversion} label={t("conversionProgress")} showValue />
        </div>
      )}

      {(phase === "error" || phase === "failed") && (
        <div role="alert" className="flex flex-wrap items-center gap-2" data-testid="slides-failed">
          <p className="text-danger text-sm">
            {phase === "failed" ? t("conversionFailed") : errorText(uploadError)}
          </p>
          {file && (
            <Button variant="secondary" size="sm" onClick={() => void start(file)}>
              <RefreshCw className="size-4" aria-hidden />
              {t("retry")}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

function SlideTile({
  slide,
  value,
  index,
  selected,
  onSelect,
}: {
  slide: Slide;
  value: SlideValue;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const t = useTranslations("admin.topic.slides");
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: value.id });
  const n = index + 1;
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      data-testid="slide-tile"
      data-hidden={value.hidden || undefined}
      className={cn("relative", isDragging && "z-10")}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={t(value.hidden ? "selectHidden" : "select", { n })}
        className={cn(
          "border-border bg-subtle rounded-ds-sm block w-full overflow-hidden border-2 transition-shadow",
          selected ? "border-ds-accent ring-ds-accent/30 ring-4" : "hover:border-primary-300",
          isDragging && "shadow-lg",
        )}
      >
        <span className="relative block aspect-video">
          <Image
            src={slide.thumb_url}
            alt=""
            fill
            sizes="200px"
            unoptimized
            className={cn("object-cover", value.hidden && "opacity-40 grayscale")}
          />
        </span>
      </button>
      <span className="bg-ds-ink/80 pointer-events-none absolute top-1.5 left-1.5 rounded-md px-1.5 text-xs font-bold text-white tabular-nums">
        {n}
      </span>
      {value.hidden && (
        <span className="bg-ds-ink/80 pointer-events-none absolute right-1.5 bottom-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-white">
          <EyeOff className="size-3.5" aria-hidden />
          {t("hiddenBadge")}
        </span>
      )}
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={t("drag", { n })}
        data-testid="slide-drag"
        className="bg-surface/90 text-foreground hover:bg-surface absolute top-1 right-1 inline-flex size-11 cursor-grab touch-none items-center justify-center rounded-lg shadow-sm active:cursor-grabbing sm:size-9"
      >
        <GripVertical className="size-4" aria-hidden />
      </button>
    </li>
  );
}

function SlidesForm({ topicId, presentation }: { topicId: string; presentation: Presentation }) {
  const t = useTranslations("admin.topic.slides");
  const te = useTranslations("admin.topic.errors");
  const tc = useTranslations("admin.common");
  const queryClient = useQueryClient();
  const errorText = useAdminErrorText();
  const { toast } = useToast();
  const ordered = sortSlides(presentation.slides);
  const byId = new Map(ordered.map((slide) => [slide.id, slide]));
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { isDirty, errors },
  } = useForm<SlidesValues>({
    defaultValues: {
      slides: ordered.map(({ id, alt, note, hidden }) => ({ id, alt, note, hidden })),
    },
    resolver: slidesResolver,
  });
  const { fields, move } = useFieldArray({ control, name: "slides", keyName: "key" });
  const values = useWatch({ control, name: "slides" });
  const [selectedId, setSelectedId] = useState(ordered[0]?.id ?? null);
  const selectedIndex = Math.max(
    0,
    fields.findIndex((field) => field.id === selectedId),
  );
  const selected = byId.get(fields[selectedIndex]?.id ?? "");
  const visibleCount = values.filter((slide) => !slide.hidden).length;

  const save = useMutation({
    mutationFn: (input: SlidesValues) =>
      getTopicMaterialsApi().patchSlides(
        presentation.id,
        toSlidePatches(
          input.slides.map((slide, index) => ({
            ...(byId.get(slide.id) as Slide),
            ...slide,
            order: index + 1,
          })),
        ),
      ),
    onSuccess: (next) => {
      queryClient.setQueryData(topicKeys.presentation(topicId), next);
      reset({
        slides: sortSlides(next.slides).map(({ id, alt, note, hidden }) => ({
          id,
          alt,
          note,
          hidden,
        })),
      });
      toast({ variant: "success", title: t("saved") });
    },
  });

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
  const fieldError = (path: string, errs: FieldErrors<SlidesValues>) => {
    const message: unknown = get(errs, path)?.message;
    return typeof message === "string" && message
      ? te.has(message)
        ? te(message)
        : te("invalid")
      : undefined;
  };

  return (
    <form
      noValidate
      aria-labelledby="slides-grid-title"
      onSubmit={handleSubmit((input) => save.mutate(input))}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="slides-grid-title" className="text-foreground text-base font-semibold">
          {t("gridTitle")}
        </h2>
        <p className="text-muted text-sm" data-testid="slides-summary">
          {t("count", { total: fields.length, visible: visibleCount })}
          {presentation.pdf_url && (
            <>
              {" · "}
              <a
                href={presentation.pdf_url}
                className="text-link hover:underline"
                target="_blank"
                rel="noopener"
              >
                {t("pdf")}
              </a>
            </>
          )}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
          accessibility={{
            announcements,
            screenReaderInstructions: { draggable: t("dnd.instructions") },
          }}
        >
          <SortableContext items={fields.map((field) => field.id)} strategy={rectSortingStrategy}>
            <ol
              className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4"
              aria-label={t("gridTitle")}
            >
              {fields.map((field, index) => {
                const slide = byId.get(field.id);
                const value = values[index] ?? field;
                return slide ? (
                  <SlideTile
                    key={field.key}
                    slide={slide}
                    value={value}
                    index={index}
                    selected={index === selectedIndex}
                    onSelect={() => setSelectedId(field.id)}
                  />
                ) : null;
              })}
            </ol>
          </SortableContext>
        </DndContext>

        {selected && (
          <section
            key={selected.id}
            aria-label={t("details", { n: selectedIndex + 1 })}
            data-testid="slide-details"
            className="border-border bg-surface rounded-ds flex flex-col gap-4 border p-4 lg:sticky lg:top-20 lg:self-start"
          >
            <div className="bg-subtle rounded-ds-sm relative aspect-video overflow-hidden">
              <Image
                src={selected.image_url}
                alt={values[selectedIndex]?.alt || t("slideAlt", { n: selectedIndex + 1 })}
                fill
                sizes="384px"
                unoptimized
                className="object-contain"
              />
            </div>
            <Controller
              control={control}
              name={`slides.${selectedIndex}.hidden`}
              render={({ field }) => (
                <Switch
                  checked={!field.value}
                  onCheckedChange={(visible) => field.onChange(!visible)}
                  label={t("visible")}
                  description={t("visibleHint")}
                  testId="slide-visible"
                />
              )}
            />
            <Textarea
              label={t("note")}
              hint={t("noteHint")}
              rows={4}
              maxLength={SLIDE_LIMITS.note}
              error={fieldError(`slides.${selectedIndex}.note`, errors)}
              {...register(`slides.${selectedIndex}.note`)}
            />
            <Input
              label={t("alt")}
              hint={t("altHint")}
              maxLength={SLIDE_LIMITS.alt}
              error={fieldError(`slides.${selectedIndex}.alt`, errors)}
              {...register(`slides.${selectedIndex}.alt`)}
            />
          </section>
        )}
      </div>

      {save.isError && (
        <p role="alert" className="text-danger text-sm">
          {errorText(save.error)}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="submit"
          loading={save.isPending}
          disabled={!isDirty}
          data-testid="slides-save"
        >
          {tc("save")}
        </Button>
        {isDirty && (
          <Button variant="ghost" disabled={save.isPending} onClick={() => reset()}>
            {t("discard")}
          </Button>
        )}
      </div>
    </form>
  );
}

/** Admin «Taqdimot»: PPTX/PDF yuklash (25 MB, progress, konvertatsiya holati), slaydlar tartibi va sozlamalari. */
export function PresentationEditor({ topicId }: { topicId: string }) {
  const presentation = useQuery(topicQueries.presentation(topicId));
  if (presentation.error) {
    return <QueryError error={presentation.error} onRetry={() => void presentation.refetch()} />;
  }
  if (presentation.isPending) return <Skeleton className="h-96" />;
  const data = presentation.data;
  return (
    <div className="flex flex-col gap-8">
      {data && data.slides.length > 0 && (
        // Yangi fayl yuklanganda (boshqa slaydlar) forma qaytadan boshlanadi; tartib o'zgarishida emas.
        <SlidesForm
          key={data.slides
            .map((slide) => slide.id)
            .sort()
            .join()}
          topicId={topicId}
          presentation={data}
        />
      )}
      <UploadZone topicId={topicId} hasPresentation={Boolean(data)} />
    </div>
  );
}
