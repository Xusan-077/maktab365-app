import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApi } from "@/lib/api";
import { queryKeys } from "@/lib/api/query-keys";

export function useToggleBookBookmark() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bookId: string) => getApi().toggleBookBookmark(bookId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.bookBookmarks() }),
  });
}
