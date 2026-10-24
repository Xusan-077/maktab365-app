import Image from "next/image";
import { Bookmark, BookOpen, MonitorSmartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import type { PdfBook } from "@/lib/pdf-books/api";
import { CoverCollage } from "./CoverCollage";

const LOGO_RATIO = 1537 / 293;

/** Desktop (lg+) chap panel: brend rangi, sarlavha, foydalar va muqovalar kollaji. */
export function BrandPanel({ books }: { books: PdfBook[] }) {
  const t = useTranslations("login");
  const tb = useTranslations("brand");
  const benefits = [
    { Icon: Bookmark, text: t("benefits.bookmark") },
    { Icon: BookOpen, text: t("benefits.favorites") },
    { Icon: MonitorSmartphone, text: t("benefits.devices") },
  ];
  return (
    <aside className="bg-brand-panel relative hidden flex-col overflow-hidden px-16 py-12 text-white lg:flex">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -right-40 size-[520px] rounded-full bg-white/[0.06]"
      />
      <Link href="/" className="relative inline-flex self-start rounded-lg" aria-label={tb("name")}>
        <Image
          src="/logo-white.svg"
          alt={tb("name")}
          width={Math.round(34 * LOGO_RATIO)}
          height={34}
          unoptimized
          priority
          style={{ height: 34, width: Math.round(34 * LOGO_RATIO) }}
          className="block max-w-none"
        />
      </Link>
      <div className="relative mt-16 flex flex-col gap-5">
        <p className="max-w-[520px] text-[52px] leading-[1.05] font-extrabold tracking-[-0.02em]">
          {t("headline")}
        </p>
        <p className="max-w-[520px] text-[18px] text-white/[0.86]">{t("lead")}</p>
        <ul aria-label={t("benefits.label")} className="mt-3 flex flex-col gap-4">
          {benefits.map(({ Icon, text }) => (
            <li key={text} className="flex items-center gap-3.5 text-[16px] font-medium">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-white/[0.14]">
                <Icon className="size-5" aria-hidden />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>
      <CoverCollage books={books} />
    </aside>
  );
}
