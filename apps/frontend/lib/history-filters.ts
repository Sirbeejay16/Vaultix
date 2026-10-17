import { fetchEvents, IEventResponse } from "@/lib/escrow-api";

export interface HistoryFilters {
  status: string;
  asset: string;
  eventType: string;
  dateFrom: string;
  dateTo: string;
  search: string;
}

export const EMPTY_HISTORY_FILTERS: HistoryFilters = {
  status: "",
  asset: "",
  eventType: "",
  dateFrom: "",
  dateTo: "",
  search: "",
};

const PARAM_KEYS: Record<keyof HistoryFilters, string> = {
  status: "status",
  asset: "asset",
  eventType: "type",
  dateFrom: "from",
  dateTo: "to",
  search: "q",
};

export const HISTORY_PAGE_SIZE = 20;
const EXPORT_PAGE_SIZE = 100;
/** Upper bound on pages fetched for one export, to keep a runaway loop finite. */
const EXPORT_MAX_PAGES = 200;

type ParamsLike = { get(name: string): string | null };

/** Reads filters from a URL query string; unknown/missing keys become "". */
export function parseHistoryFilters(params: ParamsLike): HistoryFilters {
  const filters = { ...EMPTY_HISTORY_FILTERS };
  (Object.keys(PARAM_KEYS) as (keyof HistoryFilters)[]).forEach((key) => {
    filters[key] = params.get(PARAM_KEYS[key])?.trim() ?? "";
  });
  return filters;
}

/** Serializes only non-empty filters so default views keep a clean URL. */
export function serializeHistoryFilters(filters: HistoryFilters): string {
  const qs = new URLSearchParams();
  (Object.keys(PARAM_KEYS) as (keyof HistoryFilters)[]).forEach((key) => {
    if (filters[key]) qs.set(PARAM_KEYS[key], filters[key]);
  });
  return qs.toString();
}

export function hasActiveFilters(filters: HistoryFilters): boolean {
  return Object.values(filters).some(Boolean);
}

/** Maps UI filters to the `/events` query (date-only inputs become full-day bounds). */
export function toEventsQuery(filters: HistoryFilters) {
  return {
    paginate: "cursor" as const,
    status: filters.status || undefined,
    assetCode: filters.asset ? filters.asset.toUpperCase() : undefined,
    eventType: filters.eventType || undefined,
    dateFrom: filters.dateFrom
      ? new Date(`${filters.dateFrom}T00:00:00`).toISOString()
      : undefined,
    dateTo: filters.dateTo
      ? new Date(`${filters.dateTo}T23:59:59.999`).toISOString()
      : undefined,
    search: filters.search || undefined,
  };
}

/** Walks every cursor page of the filtered set (used for CSV export). */
export async function fetchAllFilteredEvents(
  filters: HistoryFilters,
): Promise<IEventResponse[]> {
  const all: IEventResponse[] = [];
  let cursor: string | undefined;

  for (let i = 0; i < EXPORT_MAX_PAGES; i++) {
    const page = await fetchEvents({
      ...toEventsQuery(filters),
      limit: EXPORT_PAGE_SIZE,
      cursor,
    });
    all.push(...page.data);
    if (!page.hasMore || !page.nextCursor) break;
    cursor = page.nextCursor;
  }

  return all;
}
