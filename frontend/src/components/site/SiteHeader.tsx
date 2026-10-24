"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/layout/Logo";
import { PanelSearch } from "@/components/layout/PanelSearch";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { UserMenu } from "@/components/layout/UserMenu";
import { Dialog } from "@/components/ui/Dialog";
import { SiteLocaleMenu } from "./SiteLocaleMenu";
import { SiteNav } from "./SiteNav";
import { StaffPanelLink } from "./StaffPanelLink";

const iconButton = "border-border bg-surface hover:bg-surface-2 size-11 rounded-xl border";

/** Sayt sarlavhasi: logo, nav, til, qorong'i rejim, "Kirish"/avatar. Mobilda gamburger va yon panel. */
export function SiteHeader() {
  const t = useTranslations("site");
  const [open, setOpen] = useState(false);

  return (
    <header className="border-border bg-background present:hidden sticky top-0 z-40 border-b print:hidden">
      <div className="max-w-site mx-auto flex items-center gap-3 px-4 py-3.5 sm:px-8 md:gap-3 lg:gap-7">
        {/* Telefonda (341–400px) ham "darslik365" yozuvi bilan, kichikroq; juda tor (≤340px) — faqat belgi */}
        <Logo height={30} className="max-[400px]:hidden" />
        <Logo height={24} className="max-[340px]:hidden min-[401px]:hidden" />
        <Logo variant="mark" height={30} className="min-[341px]:hidden" />
        <SiteNav className="hidden md:block" />
        <div className="ml-auto flex items-center gap-2">
          <PanelSearch variant="icon" />
          <StaffPanelLink />
          <SiteLocaleMenu className="hidden md:block" />
          <ThemeToggle className={`${iconButton} hidden md:inline-flex`} />
          <UserMenu signInClassName="h-11 rounded-xl px-[1.125rem] text-[0.9375rem] font-semibold" />
          <button
            type="button"
            aria-label={t("openMenu")}
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => setOpen(true)}
            className={`${iconButton} text-foreground inline-flex items-center justify-center md:hidden`}
          >
            <Menu className="size-5" aria-hidden />
          </button>
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen} title={t("menu")} placement="right">
        <SiteNav orientation="vertical" onNavigate={() => setOpen(false)} />
        <div className="border-border flex flex-col gap-3 border-t pt-4">
          <SiteLocaleMenu variant="inline" />
          <div className="flex items-center gap-3">
            <ThemeToggle className={`${iconButton} inline-flex`} />
          </div>
        </div>
      </Dialog>
    </header>
  );
}
