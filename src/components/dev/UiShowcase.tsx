"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Accordion } from "@/components/ui/Accordion";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/hooks/useToast";
import { SelectDemos } from "./SelectDemos";

const PRIMARY_SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
const ACCENT_SHADES = [50, 100, 200, 300, 400, 500] as const;
const SEMANTIC = [
  "background",
  "surface",
  "subtle",
  "foreground",
  "muted",
  "border",
  "primary-soft",
  "accent-soft",
  "success-soft",
  "danger-soft",
] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="border-border border-b pb-2 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="border-border size-12 rounded-lg border" style={{ background: color }} />
      <span className="text-muted text-xs">{label}</span>
    </div>
  );
}

export function UiShowcase() {
  const t = useTranslations("dev");
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedChip, setSelectedChip] = useState("grade");

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-10 px-4 py-10 sm:px-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted mt-1">{t("intro")}</p>
      </header>

      <Section title={t("colors")}>
        <div className="flex flex-wrap gap-3">
          {PRIMARY_SHADES.map((s) => (
            <Swatch key={s} label={`primary-${s}`} color={`var(--color-primary-${s})`} />
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          {ACCENT_SHADES.map((s) => (
            <Swatch key={s} label={`accent-${s}`} color={`var(--color-accent-${s})`} />
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          {SEMANTIC.map((name) => (
            <Swatch key={name} label={name} color={`var(--${name})`} />
          ))}
        </div>
      </Section>

      <Section title={t("buttons")}>
        <div className="flex flex-wrap items-center gap-3">
          <Button>{t("primary")}</Button>
          <Button variant="secondary">{t("secondary")}</Button>
          <Button variant="ghost">{t("ghost")}</Button>
          <Button variant="accent">{t("accent")}</Button>
          <Button variant="danger">{t("danger")}</Button>
          <Button disabled>{t("disabled")}</Button>
          <Button loading>{t("loading")}</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">{t("small")}</Button>
          <Button size="md">{t("medium")}</Button>
          <Button size="lg">{t("large")}</Button>
        </div>
      </Section>

      <Section title={t("fields")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t("sampleLabel")}
            placeholder={t("samplePlaceholder")}
            hint={t("sampleHint")}
          />
          <Input label={t("sampleLabel")} defaultValue="…" error={t("sampleError")} />
          <Input label={t("sampleLabel")} disabled placeholder={t("samplePlaceholder")} />
        </div>
      </Section>

      <Section title={t("selects")}>
        <SelectDemos />
      </Section>

      <Section title={t("badges")}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{t("grade")}</Badge>
          <Badge variant="primary">{t("subject")}</Badge>
          <Badge variant="accent">{t("note")}</Badge>
          <Badge variant="success">{t("done")}</Badge>
          <Badge variant="danger">{t("failed")}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["grade", "subject", "done"] as const).map((key) => (
            <Chip key={key} selected={selectedChip === key} onClick={() => setSelectedChip(key)}>
              {t(key)}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title={t("surfaces")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card interactive>
            <CardTitle>{t("sampleTitle")}</CardTitle>
            <CardDescription>{t("sampleBody")}</CardDescription>
          </Card>
          <div className="border-accent-300/60 bg-accent-soft text-accent-soft-foreground rounded-xl border p-5 text-sm">
            {t("important")}
          </div>
        </div>
      </Section>

      <Section title={t("disclosure")}>
        <Tabs
          label={t("tabsLabel")}
          items={[
            {
              id: "theory",
              label: t("tabOne"),
              content: <p className="text-muted text-sm">{t("sampleBody")}</p>,
            },
            {
              id: "practice",
              label: t("tabTwo"),
              content: <p className="text-muted text-sm">{t("sampleBody")}</p>,
            },
            {
              id: "test",
              label: t("tabThree"),
              content: <p className="text-muted text-sm">{t("sampleBody")}</p>,
            },
          ]}
        />
        <Accordion
          exclusiveName="dev-faq"
          items={[
            { id: "one", title: t("accordionOne"), content: t("accordionBody") },
            { id: "two", title: t("accordionTwo"), content: t("accordionBody") },
          ]}
        />
      </Section>

      <Section title={t("feedback")}>
        <ProgressBar value={65} label={t("progress")} showValue />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setDialogOpen(true)}>
            {t("openDialog")}
          </Button>
          <Button
            variant="secondary"
            onClick={() => toast({ title: t("toastInfo"), description: t("toastDescription") })}
          >
            {t("toastInfo")}
          </Button>
          <Button
            variant="secondary"
            onClick={() => toast({ variant: "success", title: t("toastSuccess") })}
          >
            {t("toastSuccess")}
          </Button>
          <Button
            variant="secondary"
            onClick={() => toast({ variant: "error", title: t("toastError") })}
          >
            {t("toastError")}
          </Button>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          title={t("dialogTitle")}
          description={t("dialogBody")}
        >
          <Input label={t("sampleLabel")} placeholder={t("samplePlaceholder")} />
        </Dialog>
      </Section>
    </div>
  );
}
