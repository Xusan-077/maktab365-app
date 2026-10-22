"use client";

import { useEffect, useId, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { LayoutDashboard, LifeBuoy, LogOut, Settings } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { AnimatePresence, m, popover } from "@/components/ui/motion";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAppBase } from "@/hooks/useAppBase";
import { useAuth } from "@/hooks/useAuth";
import { useMe } from "@/hooks/useMe";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { dashboardPath, helpPath, ROUTES } from "@/lib/utils/routes";
import { SignInButton } from "./SignInButton";

const itemClasses =
  "hover:bg-subtle focus-visible:bg-subtle flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium";

function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

export function Avatar({
  name,
  image,
  className,
}: {
  name: string;
  image?: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  return image && !failed ? (
    // Google avatari tashqi domen: next/image uchun remotePatterns kerak bo'lmasligi uchun oddiy <img>.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={cn("size-9 rounded-full object-cover", className)}
    />
  ) : (
    <span
      aria-hidden
      className={cn(
        "bg-primary-soft text-primary-soft-foreground inline-flex size-9 items-center justify-center rounded-full text-sm font-semibold",
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}

/**
 * Marketing headerida: "Kirish" yoki avatar menyusi (kabinet/ustoz paneliga o'tish menyuning birinchi bandi).
 * Panel topbar'ida (`variant="panel"`): avatar menyusi (sozlamalar, yordam, chiqish).
 */
export function UserMenu({ variant = "site" }: { variant?: "site" | "panel" }) {
  const t = useTranslations("auth");
  const tn = useTranslations("nav");
  const tp = useTranslations("panel");
  const locale = useLocale();
  const base = useAppBase();
  const { status, sessionUser } = useAuth();
  const { data: me } = useMe();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);

  const items = () =>
    Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

  function openMenu(focus: "first" | "last" | "none" = "first") {
    setOpen(true);
    if (focus === "none") return;
    // Menyu chizilgandan keyin fokus beriladi
    requestAnimationFrame(() => {
      const list = items();
      (focus === "first" ? list[0] : list.at(-1))?.focus();
    });
  }

  function closeMenu(restoreFocus = true) {
    setOpen(false);
    if (restoreFocus) buttonRef.current?.focus();
  }

  function onMenuKeyDown(event: React.KeyboardEvent) {
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLElement);
    const move = (next: number) => {
      event.preventDefault();
      list[(next + list.length) % list.length]?.focus();
    };
    if (event.key === "ArrowDown") move(index + 1);
    else if (event.key === "ArrowUp") move(index - 1);
    else if (event.key === "Home") move(0);
    else if (event.key === "End") move(list.length - 1);
    else if (event.key === "Tab") closeMenu(false);
  }

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (status === "loading") return <Skeleton className="h-10 w-24" />;
  if (!sessionUser) return <SignInButton>{tn("login")}</SignInButton>;

  const name = me?.name || sessionUser.name || sessionUser.email || "";
  const close = () => closeMenu(false);

  const panel = variant === "panel";

  return (
    <div ref={rootRef} className="relative flex items-center gap-2">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={t("menuLabel", { name })}
        onClick={() => (open ? closeMenu(false) : openMenu("none"))}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            openMenu(event.key === "ArrowDown" ? "first" : "last");
          }
        }}
        className="hover:bg-subtle inline-flex size-10 items-center justify-center rounded-full"
      >
        <Avatar name={name} image={sessionUser.image} />
      </button>
      <AnimatePresence>
        {open && (
          <m.div
            ref={menuRef}
            variants={popover}
            initial="hidden"
            animate="show"
            exit="exit"
            style={{ transformOrigin: "top right" }}
            id={menuId}
            role="menu"
            aria-label={t("menuLabel", { name })}
            onKeyDown={onMenuKeyDown}
            className="border-border bg-surface absolute top-full right-0 z-50 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-xl border p-2 shadow-lg"
          >
            <div className="px-3 py-2">
              <p className="truncate text-sm font-semibold">{name}</p>
              {sessionUser.email && (
                <p className="text-muted truncate text-xs">{sessionUser.email}</p>
              )}
            </div>
            <div className="border-border border-t pt-1">
              {!panel && me && (
                <Link
                  role="menuitem"
                  href={dashboardPath(me.role)}
                  onClick={close}
                  className={itemClasses}
                >
                  <LayoutDashboard className="size-4" aria-hidden />
                  {me.role === "teacher" ? t("teacherPanel") : t("cabinet")}
                </Link>
              )}
              {panel && base !== "marketing" && (
                <Link role="menuitem" href={helpPath(base)} onClick={close} className={itemClasses}>
                  <LifeBuoy className="size-4" aria-hidden />
                  {tp("help")}
                </Link>
              )}
              <Link role="menuitem" href={ROUTES.settings} onClick={close} className={itemClasses}>
                <Settings className="size-4" aria-hidden />
                {t("settings")}
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={() => void signOut({ redirectTo: `/${locale}` })}
                className={itemClasses}
              >
                <LogOut className="size-4" aria-hidden />
                {t("signOut")}
              </button>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
