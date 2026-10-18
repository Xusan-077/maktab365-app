import { useTranslations } from "next-intl";
import { HOW_IT_WORKS_ID } from "./ids";
import { Section } from "./Section";

const STEP_KEYS = ["one", "two", "three", "four"] as const;

export function HowItWorks() {
  const t = useTranslations("home.how");
  return (
    <Section id={HOW_IT_WORKS_ID} title={t("title")}>
      <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {STEP_KEYS.map((key, index) => (
          <li key={key} className="flex flex-col gap-2">
            <span className="bg-primary-600 inline-flex size-9 items-center justify-center rounded-full font-semibold text-white">
              {index + 1}
            </span>
            <h3 className="text-base font-semibold">{t(`steps.${key}.title`)}</h3>
            <p className="text-muted text-sm">{t(`steps.${key}.text`)}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
