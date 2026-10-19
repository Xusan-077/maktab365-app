"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Resolved } from "@/lib/i18n/localize-blocks";
import type { WidgetBlock } from "@/types/topic";

function WidgetLoading() {
  const t = useTranslations("topic.graph");
  return (
    <div role="status" className="border-border rounded-xl border p-5">
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="h-56 w-full" />
    </div>
  );
}

// Widget kodi faqat shu kind mavzuda uchraganda yuklanadi (har biri alohida chunk).
const QuadraticGraph = dynamic(
  () => import("./widgets/QuadraticGraph").then((module) => module.QuadraticGraph),
  { loading: WidgetLoading },
);
const ChoiceExplain = dynamic(
  () => import("./widgets/ChoiceExplain").then((module) => module.ChoiceExplain),
  { loading: WidgetLoading },
);

const GeometryPoints = dynamic(
  () => import("./widgets/GeometryPoints").then((module) => module.GeometryPoints),
  { loading: WidgetLoading },
);
const Timeline = dynamic(() => import("./widgets/Timeline").then((module) => module.Timeline), {
  loading: WidgetLoading,
});

export type WidgetView = Resolved<WidgetBlock>;

/** Widget registry: blok `kind` bo'yicha komponentni dynamic import qiladi. */
export function WidgetHost({ widget }: { widget: WidgetView }) {
  switch (widget.kind) {
    case "quadratic-graph":
      return <QuadraticGraph {...widget.props} />;
    case "choice-explain":
      return <ChoiceExplain {...widget.props} />;
    case "geometry-points":
      return <GeometryPoints {...widget.props} />;
    case "timeline":
      return <Timeline {...widget.props} />;
  }
}
