"use client";

import type { ReactNode } from "react";
import { AccountGate } from "@/components/cabinet/AccountGate";
import { useAppBase } from "@/hooks/useAppBase";
import { usePathname } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { appBaseOfPath } from "@/lib/utils/routes";
import { PANEL_CONTAINER } from "./containers";
import { AppMobileNav } from "./AppMobileNav";
import { AppSidebar } from "./AppSidebar";
import { AppTopbar } from "./AppTopbar";
import { MAIN_CONTENT_ID } from "./SkipLink";

function ShellFrame({ children }: { children: ReactNode }) {
  const base = useAppBase();
  const panel = base === "marketing" ? "kabinet" : base;

  return (
    <div data-layout="app" className="flex min-h-dvh print:block">
      <AppSidebar panel={panel} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar />
        <main
          id={MAIN_CONTENT_ID}
          tabIndex={-1}
          className={cn(
            PANEL_CONTAINER,
            "flex flex-1 flex-col gap-8 px-4 py-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] focus:outline-none sm:px-6 lg:py-8 lg:pb-8 print:max-w-none print:p-0",
          )}
        >
          {children}
        </main>
      </div>
      <AppMobileNav panel={panel} />
    </div>
  );
}

/**
 * Shaxsiy panel qobig'i (kabinet, ustoz, sozlamalar): qo'riqchi, chap sidebar, topbar va mobil tab bar.
 * Marketing header/footer bu yerda yo'q. Rol yo'ldan olinadi (`/kabinet` → o'quvchi, `/ustoz` → o'qituvchi);
 * `/sozlamalar` ikkala rolga ochiq.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const panel = appBaseOfPath(pathname);
  const role = panel ? (panel === "ustoz" ? "teacher" : "student") : undefined;

  return (
    <AccountGate role={role}>
      <ShellFrame>{children}</ShellFrame>
    </AccountGate>
  );
}
