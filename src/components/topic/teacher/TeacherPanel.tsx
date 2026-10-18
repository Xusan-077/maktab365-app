"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Presentation,
  Printer,
  QrCode,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { useMe } from "@/hooks/useMe";
import { hidePreviousStep, revealNextStep } from "@/lib/utils/example-registry";
import { useTeacherStore } from "@/stores/teacher.store";
import { PrintDialog, type PrintSection } from "./PrintDialog";
import { ShareDialog } from "./ShareDialog";

const isEditable = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

const isInteractive = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  target.closest("button, a[href], summary, [role='button'], [contenteditable='true']") !== null;

/** O'qituvchi vositalari: faqat o'qituvchi profilida ko'rinadi. */
export function TeacherPanel({ sections }: { sections: PrintSection[] }) {
  const { data: me } = useMe();
  if (me?.role !== "teacher") return null;
  return <TeacherTools sections={sections} />;
}

function TeacherTools({ sections }: { sections: PrintSection[] }) {
  const t = useTranslations("topic.teacher");
  const presenting = useTeacherStore((state) => state.presenting);
  const showAnswers = useTeacherStore((state) => state.showAnswers);
  const setPresenting = useTeacherStore((state) => state.setPresenting);
  const setShowAnswers = useTeacherStore((state) => state.setShowAnswers);
  const [shareOpen, setShareOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const fullscreen = useRef(false);

  const enter = useCallback(() => {
    setPresenting(true);
    (document.activeElement as HTMLElement | null)?.blur();
    // Brauzer to'liq ekrani — proyektor uchun; rad etilsa ham rejim ishlayveradi.
    document.documentElement
      .requestFullscreen?.()
      .then(() => {
        fullscreen.current = true;
      })
      .catch(() => {});
  }, [setPresenting]);

  const exit = useCallback(() => {
    setPresenting(false);
    if (document.fullscreenElement) {
      fullscreen.current = false;
      void document.exitFullscreen().catch(() => {});
    }
  }, [setPresenting]);

  // `<html data-present>` — CSS (header yashirish, matn kattalashtirish) shu belgiga tayanadi.
  useEffect(() => {
    const root = document.documentElement;
    if (presenting) root.dataset.present = "true";
    else delete root.dataset.present;
  }, [presenting]);

  // Sahifadan ketganda rejim o'chadi (keyingi sahifa oddiy ko'rinishda ochiladi).
  useEffect(
    () => () => {
      delete document.documentElement.dataset.present;
      useTeacherStore.getState().setPresenting(false);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    },
    [],
  );

  // To'liq ekrandan Esc bilan chiqilsa, taqdimot rejimi ham tugaydi.
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement && fullscreen.current) {
        fullscreen.current = false;
        setPresenting(false);
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [setPresenting]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      // Ochiq dialog o'z klavishlarini (Esc) o'zi boshqaradi; yozish maydonlariga tegmaymiz.
      if (document.querySelector("dialog[open]") || isEditable(event.target)) return;
      const live = useTeacherStore.getState();

      if (event.code === "KeyF") {
        if (event.repeat) return;
        event.preventDefault();
        if (live.presenting) exit();
        else enter();
        return;
      }
      if (!live.presenting) return;

      switch (event.code) {
        case "Escape":
          exit();
          break;
        case "Space":
          // Tugma/havola ustida bo'sh joy ularni bosadi: aralashmaymiz.
          if (isInteractive(event.target)) return;
          if (revealNextStep()) event.preventDefault();
          break;
        case "ArrowRight":
        case "PageDown":
          if (revealNextStep()) event.preventDefault();
          break;
        case "ArrowLeft":
        case "PageUp":
          if (hidePreviousStep()) event.preventDefault();
          break;
        case "KeyA":
          live.setShowAnswers(!live.showAnswers);
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enter, exit]);

  const answersButton = (
    <Button
      variant="secondary"
      aria-pressed={showAnswers}
      aria-keyshortcuts="A"
      onClick={() => setShowAnswers(!showAnswers)}
    >
      {showAnswers ? (
        <EyeOff className="size-4" aria-hidden />
      ) : (
        <Eye className="size-4" aria-hidden />
      )}
      {showAnswers ? t("hideAnswers") : t("showAnswers")}
    </Button>
  );

  return (
    <>
      <section
        aria-labelledby="teacher-tools-title"
        className="border-border bg-subtle present:hidden flex flex-col gap-3 rounded-xl border p-4 print:hidden"
      >
        <h2 id="teacher-tools-title" className="text-sm font-semibold">
          {t("title")}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button aria-keyshortcuts="F" onClick={enter}>
            <Presentation className="size-4" aria-hidden />
            {t("present")}
            <kbd className="bg-primary-700 rounded px-1.5 text-xs">F</kbd>
          </Button>
          {answersButton}
          <Button variant="secondary" onClick={() => setShareOpen(true)}>
            <QrCode className="size-4" aria-hidden />
            {t("share.open")}
          </Button>
          <Button variant="secondary" onClick={() => setPrintOpen(true)}>
            <Printer className="size-4" aria-hidden />
            {t("print.open")}
          </Button>
        </div>
        <p className="text-muted text-sm">{t("hint")}</p>
      </section>

      {presenting && (
        <div
          role="toolbar"
          aria-label={t("barLabel")}
          className="border-border bg-surface/95 fixed right-3 bottom-3 z-50 flex max-w-[calc(100vw-1.5rem)] flex-wrap items-center gap-2 rounded-xl border p-2 shadow-lg backdrop-blur print:hidden"
        >
          <Button variant="ghost" size="icon" aria-label={t("prevStep")} onClick={hidePreviousStep}>
            <ChevronLeft className="size-5" aria-hidden />
          </Button>
          <Button variant="secondary" aria-keyshortcuts="Space ArrowRight" onClick={revealNextStep}>
            {t("nextStep")}
            <ChevronRight className="size-4" aria-hidden />
          </Button>
          {answersButton}
          <Button
            variant="secondary"
            size="icon"
            aria-label={t("share.open")}
            onClick={() => setShareOpen(true)}
          >
            <QrCode className="size-5" aria-hidden />
          </Button>
          <Button variant="primary" aria-keyshortcuts="Escape" onClick={exit}>
            <X className="size-4" aria-hidden />
            {t("exit")}
            <kbd className="bg-primary-700 rounded px-1.5 text-xs">Esc</kbd>
          </Button>
        </div>
      )}

      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} />
      <PrintDialog open={printOpen} onOpenChange={setPrintOpen} sections={sections} />
    </>
  );
}
