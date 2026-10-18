import { useQuery } from "@tanstack/react-query";
import { apiQueries } from "@/lib/api/queries";
import { useMe } from "./useMe";
import { useSubjects } from "./useSubjects";

/** O'quvchi sinfiga mos darsliklar va ularning fanlari. Sinf belgilanmagan bo'lsa ro'yxat bo'sh. */
export function useMyBooks() {
  const { data: me } = useMe();
  const grade = me?.role === "student" ? me.grade : undefined;
  const books = useQuery({ ...apiQueries.books({ grade }), enabled: grade !== undefined });
  const { data: subjects = [] } = useSubjects();
  return {
    grade,
    books: grade === undefined ? [] : (books.data ?? []),
    subjects,
    isPending: grade !== undefined && books.isPending,
  };
}
