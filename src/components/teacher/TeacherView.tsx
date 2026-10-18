"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Panel } from "@/components/cabinet/Panel";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { SEARCH_MIN_LENGTH } from "@/lib/api/queries";
import { useBooks } from "@/hooks/useBooks";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useMe } from "@/hooks/useMe";
import { useTeacherSelection } from "@/hooks/useTeacherSelection";
import { Link } from "@/lib/i18n/navigation";
import { ROUTES } from "@/lib/utils/routes";
import { filterBooks } from "@/lib/utils/teacher-filters";
import { useTeacherStore } from "@/stores/teacher.store";
import { BookGrid } from "./BookGrid";
import { FilterBar } from "./FilterBar";
import { MaterialSearch } from "./MaterialSearch";
import { RecentTopics } from "./RecentTopics";
import { SavedMaterials } from "./SavedMaterials";
import { SearchResults } from "./SearchResults";

const SIDE_LIST_LIMIT = 4;
const SEARCH_DELAY_MS = 250;

function FilteredBooks() {
  const t = useTranslations("teacher.books");
  const selection = useTeacherSelection();
  const { data: books, isPending, isError } = useBooks();
  const setSubjects = useTeacherStore((state) => state.setSubjects);
  const setGrades = useTeacherStore((state) => state.setGrades);

  if (isPending) return <Skeleton className="h-48 w-full" />;
  if (isError) return <p className="text-muted">{t("loadFailed")}</p>;

  const filtered = filterBooks(books, selection);
  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-muted">{t("empty")}</p>
        <Button
          variant="secondary"
          onClick={() => {
            setSubjects([]);
            setGrades([]);
          }}
        >
          {t("clearFilters")}
        </Button>
      </div>
    );
  }
  return <BookGrid books={filtered} />;
}

/** O'qituvchi bosh sahifasi: kerakli materialni tez topish (qidiruv, filtr, kitoblar, yaqinda ochilgan, saqlangan). */
export function TeacherView() {
  const t = useTranslations("teacher");
  const { data: me } = useMe();
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query.trim(), SEARCH_DELAY_MS);
  const searching = debounced.length >= SEARCH_MIN_LENGTH;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">
          {t("greeting", { name: me?.name ?? "" })}
        </h1>
        <p className="text-muted">{t("lead")}</p>
      </header>

      <MaterialSearch value={query} onChange={setQuery} />
      <FilterBar />

      {searching ? (
        <SearchResults query={debounced} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section aria-labelledby="teacher-books" className="flex flex-col gap-3">
            <h2 id="teacher-books" className="text-xl font-semibold">
              {t("books.title")}
            </h2>
            <FilteredBooks />
          </section>
          <div className="flex flex-col gap-6">
            <Panel title={t("recent.title")}>
              <RecentTopics limit={SIDE_LIST_LIMIT} />
            </Panel>
            <Panel
              title={t("saved.title")}
              footer={
                <Link href={ROUTES.teacherSaved} className="text-link hover:underline">
                  {t("saved.all")}
                </Link>
              }
            >
              <SavedMaterials limit={SIDE_LIST_LIMIT} />
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
