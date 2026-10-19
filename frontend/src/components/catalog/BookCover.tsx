import type { Book } from "@/types/catalog";
import type { LocalizedText } from "@/types/i18n";
import { cn } from "@/lib/utils/cn";
import { getLocalized } from "@/lib/i18n/localized";
import type { Locale } from "@/lib/i18n/config";

/** Muqova rangi `bookId` dan deterministik tanlanadi (rasm bo'lmaganda placeholder). */
const PALETTES = [
  "from-primary-600 to-primary-800",
  "from-emerald-600 to-emerald-800",
  "from-violet-600 to-violet-800",
  "from-rose-600 to-rose-800",
  "from-cyan-700 to-cyan-900",
  "from-amber-700 to-amber-900",
] as const;

function hash(value: string): number {
  let result = 0;
  for (const char of value) result = (result * 31 + char.charCodeAt(0)) >>> 0;
  return result;
}

export interface BookCoverProps {
  book: Book;
  subjectName: LocalizedText;
  locale: Locale;
  className?: string;
}

/** Dekorativ: kitob ma'lumotlari yonida matn sifatida ham beriladi, shuning uchun ekran o'qigichdan yashirilgan. */
export function BookCover({ book, subjectName, locale, className }: BookCoverProps) {
  if (book.coverUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- tashqi muqova manzillari uchun domen ro'yxati yo'q
      <img
        src={book.coverUrl}
        alt=""
        loading="lazy"
        decoding="async"
        className={cn("aspect-[3/4] rounded-lg object-cover shadow-md", className)}
      />
    );
  }

  return (
    <div
      aria-hidden
      className={cn(
        "relative flex aspect-[3/4] flex-col justify-between overflow-hidden rounded-lg bg-linear-to-br p-3 text-white shadow-md",
        PALETTES[hash(book.id) % PALETTES.length],
        className,
      )}
    >
      <span className="text-[0.65rem] font-semibold tracking-wide uppercase opacity-90">
        {getLocalized(subjectName, locale)}
      </span>
      <span className="text-center text-6xl leading-none font-bold opacity-95">{book.grade}</span>
      <span className="line-clamp-2 text-xs leading-snug font-medium">
        {getLocalized(book.title, locale)}
      </span>
    </div>
  );
}
