import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchEvents, IEventsListResponse } from "@/lib/escrow-api";
import {
  HISTORY_PAGE_SIZE,
  HistoryFilters,
  toEventsQuery,
} from "@/lib/history-filters";

export const useTransactionHistory = (filters: HistoryFilters) =>
  useInfiniteQuery<IEventsListResponse>({
    queryKey: ["transaction-history", filters],
    queryFn: ({ pageParam }) =>
      fetchEvents({
        ...toEventsQuery(filters),
        limit: HISTORY_PAGE_SIZE,
        cursor: pageParam as string | undefined,
      }),
    initialPageParam: undefined,
    getNextPageParam: (last) =>
      last.hasMore && last.nextCursor ? last.nextCursor : undefined,
  });
