import type { ComponentType } from "react";
import { Check, GraduationCap, School } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardTitle } from "@/components/ui/Card";
import { Section } from "./Section";

const ITEM_KEYS = ["a", "b", "c"] as const;

const AUDIENCES: { id: "student" | "teacher"; icon: ComponentType<{ className?: string }> }[] = [
  { id: "student", icon: GraduationCap },
  { id: "teacher", icon: School },
];

export function AudienceSection() {
  const t = useTranslations("home.audience");
  return (
    <Section id="audience" title={t("title")}>
      <div className="grid gap-4 md:grid-cols-2">
        {AUDIENCES.map(({ id, icon: Icon }) => (
          <Card key={id} className="flex flex-col gap-4 p-6">
            <div className="flex items-center gap-3">
              <span className="bg-primary-soft text-primary-soft-foreground inline-flex size-10 items-center justify-center rounded-lg">
                <Icon className="size-5" />
              </span>
              <CardTitle className="text-lg">{t(`${id}.title`)}</CardTitle>
            </div>
            <ul className="flex flex-col gap-3">
              {ITEM_KEYS.map((key) => (
                <li key={key} className="flex items-start gap-2 text-base">
                  <Check className="text-success mt-1 size-4 shrink-0" aria-hidden />
                  <span>{t(`${id}.items.${key}`)}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </Section>
  );
}
