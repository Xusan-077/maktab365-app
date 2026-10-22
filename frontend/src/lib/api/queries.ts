import { queryOptions } from "@tanstack/react-query";
import { getApi } from "./index";
import { queryKeys } from "./query-keys";

/** Hook'lar ham shu opsiyalardan foydalanadi (kalit va fetcher bir joyda). */
export const apiQueries = {
  me: () => queryOptions({ queryKey: queryKeys.me(), queryFn: () => getApi().getMe() }),
  mySupport: () =>
    queryOptions({ queryKey: queryKeys.mySupport(), queryFn: () => getApi().getMySupport() }),
};
