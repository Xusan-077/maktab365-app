"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useAppBase } from "@/hooks/useAppBase";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { baseHome } from "@/lib/utils/routes";

/** SVG'larning asl o'lchamlari (viewBox): kenglik balandlikka mutanosib hisoblanadi. */
const LOGO_ASSETS = {
  horizontal: {
    light: "/logo-horizontal.svg",
    dark: "/logo-horizontal-dark.svg",
    ratio: 1272 / 233,
  },
  mark: { light: "/logo-mark.svg", dark: "/logo-mark.svg", ratio: 324 / 233 },
} as const;

export interface LogoProps {
  variant?: "horizontal" | "mark";
  /** Piksel balandligi: horizontal ≥ 28, belgi ≥ 16. */
  height?: number;
  /** Berilmasa: marketingda `/`, panelda panelning bosh sahifasi. */
  href?: string;
  className?: string;
}

/** Yagona logo komponenti: light/dark SVG `dark:` variant orqali almashadi (hydrationsiz ham to'g'ri). */
export function Logo({ variant = "horizontal", height = 32, href, className }: LogoProps) {
  const t = useTranslations("brand");
  const base = useAppBase();
  const asset = LOGO_ASSETS[variant];
  const width = Math.round(height * asset.ratio);
  const dark = asset.dark !== asset.light;

  const image = (src: string, extra?: string) => (
    <Image
      src={src}
      alt={t("name")}
      width={width}
      height={height}
      unoptimized
      priority
      style={{ height, width }}
      className={cn("block max-w-none", extra)}
    />
  );

  return (
    <Link
      href={href ?? baseHome(base)}
      className={cn("inline-flex shrink-0 items-center rounded-lg", className)}
    >
      {dark ? (
        <>
          {image(asset.light, "dark:hidden")}
          {image(asset.dark, "hidden dark:block")}
        </>
      ) : (
        image(asset.light)
      )}
    </Link>
  );
}
