import {
  EMPTY_HISTORY_FILTERS,
  fetchAllFilteredEvents,
  hasActiveFilters,
  parseHistoryFilters,
  serializeHistoryFilters,
  toEventsQuery,
} from '@/lib/history-filters';
import { fetchEvents } from '@/lib/escrow-api';

jest.mock('@/lib/escrow-api', () => ({ fetchEvents: jest.fn() }));

const mockFetch = fetchEvents as jest.Mock;
const ev = (id: string) => ({ id, escrowId: 'e', eventType: 'funded', createdAt: '2025-01-01' });

describe('history filters URL round trip', () => {
  it('parses filters from the query string', () => {
    const f = parseHistoryFilters(
      new URLSearchParams('status=active&asset=XLM&type=funded&from=2025-01-01&to=2025-02-01&q=logo'),
    );
    expect(f).toEqual({
      status: 'active',
      asset: 'XLM',
      eventType: 'funded',
      dateFrom: '2025-01-01',
      dateTo: '2025-02-01',
      search: 'logo',
    });
  });

  it('defaults missing params to empty', () => {
    expect(parseHistoryFilters(new URLSearchParams(''))).toEqual(EMPTY_HISTORY_FILTERS);
  });

  it('serializes only non-empty filters', () => {
    expect(serializeHistoryFilters(EMPTY_HISTORY_FILTERS)).toBe('');
    const qs = serializeHistoryFilters({ ...EMPTY_HISTORY_FILTERS, status: 'active', search: 'a b' });
    expect(parseHistoryFilters(new URLSearchParams(qs))).toEqual({
      ...EMPTY_HISTORY_FILTERS,
      status: 'active',
      search: 'a b',
    });
  });

  it('detects active filters', () => {
    expect(hasActiveFilters(EMPTY_HISTORY_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_HISTORY_FILTERS, asset: 'XLM' })).toBe(true);
  });
});

describe('toEventsQuery', () => {
  it('requests cursor pagination and uppercases the asset', () => {
    const q = toEventsQuery({ ...EMPTY_HISTORY_FILTERS, asset: 'usdc', status: 'active' });
    expect(q).toMatchObject({ paginate: 'cursor', assetCode: 'USDC', status: 'active' });
    expect(q.dateFrom).toBeUndefined();
  });

  it('expands date inputs to full-day ISO bounds', () => {
    const q = toEventsQuery({ ...EMPTY_HISTORY_FILTERS, dateFrom: '2025-01-01', dateTo: '2025-01-02' });
    expect(new Date(q.dateFrom!).getTime()).toBeLessThan(new Date(q.dateTo!).getTime());
    expect(q.dateFrom).toMatch(/Z$/);
  });
});

describe('fetchAllFilteredEvents', () => {
  beforeEach(() => mockFetch.mockReset());

  it('follows cursors until hasMore is false, applying filters each time', async () => {
    mockFetch
      .mockResolvedValueOnce({ data: [ev('1'), ev('2')], hasMore: true, nextCursor: '2' })
      .mockResolvedValueOnce({ data: [ev('3')], hasMore: false, nextCursor: null });

    const all = await fetchAllFilteredEvents({ ...EMPTY_HISTORY_FILTERS, status: 'completed' });

    expect(all.map((e) => e.id)).toEqual(['1', '2', '3']);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0][0]).toMatchObject({ status: 'completed', cursor: undefined });
    expect(mockFetch.mock.calls[1][0]).toMatchObject({ status: 'completed', cursor: '2' });
  });

  it('propagates fetch errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('boom'));
    await expect(fetchAllFilteredEvents(EMPTY_HISTORY_FILTERS)).rejects.toThrow('boom');
  });
});
