import { useTranslations } from "next-intl";
import { BookCard } from "@/components/site/BookCard";
import { BookCardSkeleton } from "@/components/site/BookCardSkeleton";
import { GradeTile } from "@/components/site/GradeTile";
import { GroupCard } from "@/components/site/GroupCard";
import { TELEGRAM_BOT_USERNAME } from "@/lib/auth/config";
import { Link } from "@/lib/i18n/navigation";
import type { PdfBook, PdfSubject } from "@/lib/pdf-books/api";
import { GROUP_URL, groupSubjects, SUBJECT_GROUPS } from "@/lib/pdf/grade-groups";
import { ROUTES } from "@/lib/utils/routes";
import { GRADES } from "@/types/catalog";

const headingClass = "text-[1.75rem] font-extrabold tracking-[-0.02em]";
const moreLink = "text-link text-[0.9375rem] font-semibold hover:underline";
const booksGrid =
  "grid grid-cols-2 gap-x-5 gap-y-6 min-[560px]:grid-cols-3 md:grid-cols-4 lg:grid-cols-6";

/**
 * "Sinf bo'yicha": 1–11-sinf kartalari va har birida nashr qilingan kitoblar soni; kitobi yo'q sinf
 * "Tez orada" (kulrang). Sonlar yuklanmasa (`null`) ko'rsatilmaydi.
 */
export function GradesSection({ gradeCounts }: { gradeCounts: Record<number, number> | null }) {
  const t = useTranslations("home.grades");
  return (
    <section aria-labelledby="home-grades" className="flex flex-col gap-6">
      <h2 id="home-grades" className={headingClass}>
        {t("title")}
      </h2>
      <div className="grid grid-cols-2 gap-3 min-[480px]:grid-cols-3 sm:grid-cols-[repeat(auto-fill,minmax(9.375rem,1fr))]">
        {GRADES.map((grade) => (
          <GradeTile
            key={grade}
            grade={grade}
            bookCount={gradeCounts ? (gradeCounts[grade] ?? 0) : undefined}
          />
        ))}
      </div>
    </section>
  );
}

/** "Fan yo'nalishlari": 5 guruh; har birida kitobi bor haqiqiy fanlar (nomlari va soni) API'dan. */
export function GroupsSection({ subjects }: { subjects: PdfSubject[] | null }) {
  const t = useTranslations("home.groups");
  return (
    <section aria-labelledby="home-groups" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h2 id="home-groups" className={headingClass}>
          {t("title")}
        </h2>
        <Link href={ROUTES.subjects} className={moreLink}>
          {t("all")}
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(13.75rem,1fr))]">
        {SUBJECT_GROUPS.map((group) => (
          <GroupCard
            key={group}
            group={group}
            subjects={subjects ? groupSubjects(subjects, group) : null}
            href={`${ROUTES.textbooks}?guruh=${GROUP_URL[group]}`}
          />
        ))}
      </div>
    </section>
  );
}

/** "Yangi qo'shilgan darsliklar": 6 ta karta; yuklanmagan bo'lsa xato, bo'sh bo'lsa bo'sh holat. */
export function LatestSection({ books }: { books: PdfBook[] | null }) {
  const t = useTranslations("home.latest");
  return (
    <section aria-labelledby="home-latest" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h2 id="home-latest" className={headingClass}>
          {t("title")}
        </h2>
        <Link href={ROUTES.textbooks} className={moreLink}>
          {t("all")}
        </Link>
      </div>
      {books === null ? (
        <p role="alert" className="text-muted">
          {t("error")}
        </p>
      ) : books.length === 0 ? (
        <p className="text-muted">{t("empty")}</p>
      ) : (
        <div className={booksGrid}>
          {books.map((book, index) => (
            <BookCard
              key={book.id}
              book={book}
              priority={index < 2}
              sizes="(min-width: 1024px) 190px, (min-width: 560px) 30vw, 45vw"
            />
          ))}
        </div>
      )}
    </section>
  );
}

/** Yuklanish paytidagi skeleton: kartalar bilan bir xil to'r (layout sakramaydi). */
export function LatestSkeleton() {
  return (
    <div className={booksGrid}>
      {Array.from({ length: 6 }, (_, index) => (
        <BookCardSkeleton key={index} />
      ))}
    </div>
  );
}

/** Telegram bot bandi (to'q ko'k). Foydalanuvchi nomi sozlanmagan bo'lsa bo'lim chizilmaydi. */
export function TelegramBand() {
  const t = useTranslations("home.telegram");
  if (!TELEGRAM_BOT_USERNAME) return null;
  return (
    <section className="bg-brand-navy border-border flex flex-wrap items-center justify-between gap-7 rounded-[1.75rem] border px-6 py-9 text-white sm:px-12 sm:py-11">
      <div className="flex max-w-[38.75rem] flex-col gap-2.5">
        <h2 className="text-2xl font-extrabold tracking-[-0.02em] sm:text-[1.875rem]">
          {t("title")}
        </h2>
        <p className="text-[1.0625rem] leading-normal text-white/80">{t("text")}</p>
      </div>
      <a
        href={`https://t.me/${TELEGRAM_BOT_USERNAME}`}
        target="_blank"
        rel="noopener noreferrer"
        className="bg-telegram flex h-[3.375rem] items-center gap-2.5 rounded-[0.875rem] px-6 text-base font-bold text-white hover:brightness-110"
      >
        <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M2.6 11.4l17.5-6.8c.8-.3 1.5.2 1.2 1.4l-3 14c-.2 1-.8 1.2-1.6.8l-4.5-3.3-2.2 2.1c-.2.2-.4.4-.9.4l.3-4.6 8.4-7.6c.4-.3-.1-.5-.6-.2L6.8 14l-4.5-1.4c-1-.3-1-1 .3-1.5z" />
        </svg>
        {t("cta")}
      </a>
    </section>
  );
}
