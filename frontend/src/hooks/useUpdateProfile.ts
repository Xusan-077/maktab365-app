import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApi } from "@/lib/api";
import { queryKeys } from "@/lib/api/query-keys";
import type { UpdateProfileInput } from "@/types/user";

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => getApi().updateProfile(input),
    onSuccess: (user) => queryClient.setQueryData(queryKeys.me(), user),
  });
}
