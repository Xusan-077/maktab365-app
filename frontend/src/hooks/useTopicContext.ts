import { useQuery } from "@tanstack/react-query";
import { apiQueries } from "@/lib/api/queries";
import { useSubjects } from "./useSubjects";
import { useTopic } from "./useTopic";

/** Mavzu va u tegishli kitob/fan; ro'yxatlarda "Fan · Sinf" qatorini ko'rsatish uchun. */
export function useTopicContext(topicId: string) {
  const topicQuery = useTopic(topicId);
  const topic = topicQuery.data;
  const bookId = topic?.bookId ?? "";
  const { data: book } = useQuery({ ...apiQueries.book(bookId), enabled: bookId !== "" });
  const { data: subjects } = useSubjects();
  const subject = subjects?.find((item) => item.id === book?.subjectId);
  return { topic, book, subject, isError: topicQuery.isError };
}
