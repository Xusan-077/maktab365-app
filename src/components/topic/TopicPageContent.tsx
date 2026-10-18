import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { getGradeCrumb, getRootCrumb, pageShellClass } from "@/components/layout/crumbs";
import { Badge } from "@/components/ui/Badge";
import { getTopicPageData } from "@/lib/api/server";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { cn } from "@/lib/utils/cn";
import { bookPath, subjectPath, type AppBase } from "@/lib/utils/routes";
import { groupBlocks, sectionDomId } from "@/lib/utils/topic-sections";
import { MarkReadButton } from "./MarkReadButton";
import { ReadingTracker } from "./ReadingTracker";
import { RecentVisit } from "./RecentVisit";
import { TeacherPanel } from "./teacher/TeacherPanel";
import { TopicRenderer } from "./TopicRenderer";
import { TopicToc } from "./TopicToc";
import { TopicToolbar } from "./TopicToolbar";

/** Mavzu sahifasi: marketing `/darsliklar/[bookId]/[topicId]` va panellardagi nusxalari. */
export async function TopicPageContent({
  bookId,
  topicId,
  base,
  locale,
}: {
  bookId: string;
  topicId: string;
  base: AppBase;
  locale: Locale;
}) {
  const data = await getTopicPageData(bookId, topicId);
  if (!data) notFound();

  const { book, subject, chapter, topic, next } = data;
  const ts = await getTranslations("topic.sections");
  const tBook = await getTranslations("book");
  const tTopic = await getTranslations("topic");
  const title = getLocalized(topic.title, locale);
  const grade = await getGradeCrumb(base, book.grade);
  const crumbs = [
    await getRootCrumb(base),
    ...(grade ? [grade] : []),
    { label: getLocalized(subject.name, locale), href: subjectPath(subject.slug, base) },
    { label: getLocalized(book.title, locale), href: bookPath(book.id, base) },
    { label: title },
  ];
  const groups = groupBlocks(topic.blocks);

  return (
    <div className={cn(pageShellClass(base), "print:max-w-none print:p-0")}>
      <Breadcrumbs items={crumbs} />

      <div className="present:lg:grid-cols-1 mt-6 grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-12 print:block">
        <aside className="present:hidden print:hidden">
          <TopicToc
            items={groups.map((group) => ({ id: sectionDomId(group.key), label: ts(group.key) }))}
          />
        </aside>

        <article className="present:mx-auto flex max-w-[44rem] min-w-0 flex-col gap-8 text-lg">
          <header className="flex flex-col gap-4">
            <p className="text-muted text-sm">
              {tBook("chapterLabel", { order: chapter.order })}.{" "}
              {getLocalized(chapter.title, locale)}
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">{title}</h1>
            {topic.status === "draft" && (
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="accent">{tTopic("draft")}</Badge>
                <span className="text-muted">{tTopic("draftHint")}</span>
              </p>
            )}
            <TopicToolbar topicId={topic.id} />
            <TeacherPanel
              sections={groups.map((group) => ({
                id: sectionDomId(group.key),
                label: ts(group.key),
              }))}
            />
          </header>
          <ReadingTracker topicId={topic.id} />
          <RecentVisit topicId={topic.id} />
          <TopicRenderer
            topicId={topic.id}
            bookId={book.id}
            groups={groups}
            locale={locale}
            next={next}
            beforeNext={<MarkReadButton topicId={topic.id} />}
          />
        </article>
      </div>
    </div>
  );
}
