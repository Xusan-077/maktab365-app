import { useTranslations } from "next-intl";
import { Accordion } from "@/components/ui/Accordion";
import { Section } from "./Section";

const FAQ_KEYS = ["free", "account", "phone", "languages"] as const;

export function FaqSection() {
  const t = useTranslations("home.faq");
  return (
    <Section id="faq" title={t("title")} className="max-w-3xl">
      <Accordion
        exclusiveName="faq"
        items={FAQ_KEYS.map((key) => ({
          id: key,
          title: t(`items.${key}.q`),
          content: t(`items.${key}.a`),
        }))}
      />
    </Section>
  );
}
