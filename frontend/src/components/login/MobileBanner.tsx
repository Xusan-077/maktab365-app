import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import type { PdfBook } from "@/lib/pdf-books/api";
import { ROUTES } from "@/lib/utils/routes";
import { CoverTile } from "./CoverTile";

const LOGO_RATIO = 1537 / 293;

/** Mobil (<lg) tepa banner: oq logo, "Kirmasdan o'qish →", sarlavha va ikki kichik muqova. */
export function MobileBanner({ books }: { books: PdfBook[] }) {
  const t = useTranslations("login");
  const tb = useTranslations("brand");
  const [first, second] = books;
  return (
    <header className="bg-brand-panel relative h-[250px] shrink-0 overflow-hidden px-5 pt-5 text-white lg:hidden">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="inline-flex rounded-lg" aria-label={tb("name")}>
          <Image
            src="/logo-white.svg"
            alt={tb("name")}
            width={Math.round(26 * LOGO_RATIO)}
            height={26}
            unoptimized
            priority
            style={{ height: 26, width: Math.round(26 * LOGO_RATIO) }}
            className="block max-w-none"
          />
        </Link>
        <Link
          href={ROUTES.textbooks}
          className="inline-flex min-h-11 items-center gap-1 rounded-lg text-sm font-semibold"
        >
          {t("readWithout")}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
      <p className="mt-6 max-w-[200px] text-[24px] leading-[1.1] font-extrabold tracking-[-0.01em]">
        {t("headline")}
      </p>
      {first && (
        <div className="absolute right-[100px] bottom-8 -rotate-[10deg]">
          <CoverTile book={first} width={84} height={112} compact />
        </div>
      )}
      {second && (
        <div className="absolute right-3 bottom-12 rotate-[5deg]">
          <CoverTile book={second} width={92} height={122} compact />
        </div>
      )}
    </header>
  );
}
