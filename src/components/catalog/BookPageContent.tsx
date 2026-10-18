import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BookCover } from "@/components/catalog/BookCover";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { getGradeCrumb, getRootCrumb, pageShellClass } from "@/components/layout/crumbs";
import { BookSaveButton } from "@/components/teacher/SaveButtons";
import { TopicReadMark } from "@/components/topic/TopicReadMark";
import { Accordion } from "@/components/ui/Accordion";
import { Badge } from "@/components/ui/Badge";
import { buttonVariants } from "@/components/ui/Button";
import { getBookPageData } from "@/lib/api/server";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { subjectPath, topicPath, type AppBase } from "@/lib/utils/routes";

const CHAPTERS_ID = "chapters";

/** Kitob sahifasi (bob va mavzular): marketing `/darsliklar/[bookId]` va panellardagi nusxalari. */
export async function BookPageContent({
  bookId,
  base,
  locale,
}: {
  bookId: string;
  base: AppBase;
  locale: Locale;
}) {
  const data = await getBookPageData(bookId);
  if (!data) notFound();

  const { book, chapters, subject } = data;
  const t = await getTranslations("book");
  const tg = await getTranslations("home.grades");
  const grade = await getGradeCrumb(base, book.grade);
  const title = getLocalized(book.title, locale);
  const crumbs = [
    await getRootCrumb(base),
    ...(grade ? [grade] : []),
    { label: getLocalized(subject.name, locale), href: subjectPath(subject.slug, base) },
    { label: title },
  ];

  return (
    <div className={cn("flex flex-col gap-8", pageShellClass(base))}>
      <Breadcrumbs items={crumbs} />

      <header className="grid gap-6 sm:grid-cols-[11rem_1fr] md:grid-cols-[14rem_1fr] md:gap-8">
        <BookCover
          book={book}
          subjectName={subject.name}
          locale={locale}
          className="w-36 sm:w-full"
        />
        <div className="flex flex-col items-start gap-4">
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="primary">{tg("chip", { grade: book.grade })}</Badge>
            <Badge>{getLocalized(subject.name, locale)}</Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-balance">{title}</h1>
          <dl className="text-muted grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-base">
            <dt>{t("author")}</dt>
            <dd className="text-foreground">{getLocalized(book.author, locale)}</dd>
            <dt>{t("year")}</dt>
            <dd className="text-foreground">{book.publishedYear}</dd>
            <dt>{t("edition")}</dt>
            <dd className="text-foreground">{getLocalized(book.edition, locale)}</dd>
          </dl>
          <div className="flex flex-wrap items-center gap-3">
            {book.pdfUrl ? (
              <a
                href={book.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "secondary", size: "lg" })}
              >
                {t("pdfRead")}
              </a>
            ) : (
              <span
                role="link"
                aria-disabled="true"
                title={t("pdfMissing")}
                className={buttonVariants({ variant: "secondary", size: "lg" })}
              >
                {t("pdfRead")}
              </span>
            )}
            {book.topicsReady ? (
              <a href={`#${CHAPTERS_ID}`} className={buttonVariants({ size: "lg" })}>
                {t("learn")}
              </a>
            ) : (
              <Badge variant="accent">{t("soon")}</Badge>
            )}
            <BookSaveButton bookId={book.id} title={title} teacherOnly />
          </div>
        </div>
      </header>

      <section id={CHAPTERS_ID} aria-labelledby="chapters-title" className="flex flex-col gap-4">
        <h2 id="chapters-title" className="text-2xl font-bold tracking-tight">
          {t("chapters")}
        </h2>
        {chapters.length === 0 ? (
          <p className="text-muted">{t("noChapters")}</p>
        ) : (
          <Accordion
            items={chapters.map((chapter, index) => ({
              id: chapter.id,
              defaultOpen: index === 0,
              title: (
                <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3">
                  <span>
                    <span className="text-muted">
                      {t("chapterLabel", { order: chapter.order })}.
                    </span>{" "}
                    {getLocalized(chapter.title, locale)}
                  </span>
                  <span className="text-muted text-xs font-normal">
                    {t("topicsCount", { count: chapter.topics.length })}
                  </span>
                </span>
              ),
              content: (
                <ol className="text-foreground flex flex-col">
                  {chapter.topics.map((topic) => (
                    <li
                      key={topic.id}
                      className="border-border flex min-h-12 items-center gap-3 border-t py-2 first:border-t-0"
                    >
                      <TopicReadMark topicId={topic.id} />
                      {topic.ready ? (
                        <Link
                          href={topicPath(book.id, topic.id, base)}
                          className="min-w-0 flex-1 rounded-md text-base font-medium hover:underline"
                        >
                          {getLocalized(topic.title, locale)}
                        </Link>
                      ) : (
                        <>
                          <span className="text-muted min-w-0 flex-1 text-base">
                            {getLocalized(topic.title, locale)}
                          </span>
                          <Badge variant="accent">{t("soon")}</Badge>
                        </>
                      )}
                    </li>
                  ))}
                </ol>
              ),
            }))}
          />
        )}
      </section>
    </div>
  );
}
