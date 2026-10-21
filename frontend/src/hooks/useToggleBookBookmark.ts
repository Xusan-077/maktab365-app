import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApi } from "@/lib/api";
import { queryKeys } from "@/lib/api/query-keys";
import type { BookBookmark } from "@/types/progress";

/** Kitobni saqlash/olib tashlash: optimistic, xatoda rollback. */
export function useToggleBookBookmark() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bookId: string) => getApi().toggleBookBookmark(bookId),
    onMutate: async (bookId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.bookBookmarks() });
      const previous = queryClient.getQueryData<BookBookmark[]>(queryKeys.bookBookmarks());
      if (previous) {
        const saved = previous.some((item) => item.bookId === bookId);
        queryClient.setQueryData<BookBookmark[]>(
          queryKeys.bookBookmarks(),
          saved
            ? previous.filter((item) => item.bookId !== bookId)
            : [
                ...previous,
                {
                  id: `pending-${bookId}`,
                  userId: "",
                  bookId,
                  createdAt: new Date().toISOString(),
                },
              ],
        );
      }
      return { previous };
    },
    onError: (_error, _bookId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.bookBookmarks(), context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookBookmarks() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.teacherDashboard() });
    },
  });
}
