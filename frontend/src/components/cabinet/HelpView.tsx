"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { PAGE_STACK } from "@/components/layout/containers";
import { MySupportList } from "@/components/support/MySupportList";
import { SupportForm } from "@/components/support/SupportForm";

/** Panel ichidagi "Yordam": tezkor maslahatlar, murojaat formasi va "Mening xabarlarim". */
export function HelpView() {
  const t = useTranslations("panel.helpPage");
  const ts = useTranslations("support");

  const tips = [t("tips.search"), t("tips.bookmarks"), t("tips.progress")];

  return (
    <div className={PAGE_STACK}>
      <PageHeader title={t("title")} description={t("lead")} />

      <div className={`${PAGE_STACK} max-w-2xl`}>
        <section aria-labelledby="help-tips" className="flex flex-col gap-3">
          <h2 id="help-tips" className="text-xl font-semibold">
            {t("tipsTitle")}
          </h2>
          <ul className="text-muted flex list-disc flex-col gap-2 pl-5">
            {tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="help-feedback" className="flex flex-col gap-4">
          <h2 id="help-feedback" className="text-xl font-semibold">
            {t("formTitle")}
          </h2>
          <SupportForm idPrefix="panel-support" />
        </section>

        <section aria-labelledby="help-mine" className="flex flex-col gap-4">
          <h2 id="help-mine" className="text-xl font-semibold">
            {ts("mine.title")}
          </h2>
          <MySupportList />
        </section>
      </div>
    </div>
  );
}
