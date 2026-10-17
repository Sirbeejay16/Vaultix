import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TransactionsPage from './page';
import { fetchEvents } from '@/lib/escrow-api';
import { fetchAllFilteredEvents } from '@/lib/history-filters';
import { downloadCSV } from '@/lib/csv-export';

const replace = jest.fn();
let search = '';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/transactions',
  useSearchParams: () => new URLSearchParams(search),
}));
jest.mock('@/lib/escrow-api', () => ({ fetchEvents: jest.fn() }));
jest.mock('@/lib/history-filters', () => ({
  ...jest.requireActual('@/lib/history-filters'),
  fetchAllFilteredEvents: jest.fn(),
}));
jest.mock('@/lib/csv-export', () => ({
  ...jest.requireActual('@/lib/csv-export'),
  downloadCSV: jest.fn(),
}));
jest.mock('@/hooks/useToast', () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn() }),
}));

const mockFetch = fetchEvents as jest.Mock;
const ev = (id: string) => ({
  id,
  escrowId: `escrow-${id}-aaaaaaaa`,
  eventType: 'funded',
  createdAt: '2025-01-01T00:00:00Z',
  escrow: { id: 'x', title: `Title ${id}`, amount: 10, assetCode: 'XLM', status: 'ACTIVE' },
});

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TransactionsPage />
    </QueryClientProvider>,
  );
};

describe('TransactionsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    search = '';
  });

  it('shows the empty state', async () => {
    mockFetch.mockResolvedValue({ data: [], hasMore: false, nextCursor: null });
    renderPage();
    expect(await screen.findByText('No transactions found')).toBeInTheDocument();
  });

  it('shows an error state and retries', async () => {
    mockFetch.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce({ data: [ev('1')], hasMore: false });
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load transactions');
    await userEvent.click(screen.getByText('Try again'));
    expect(await screen.findByText('Title 1')).toBeInTheDocument();
  });

  it('reads filters from the URL and sends them to the API', async () => {
    search = 'status=active&asset=XLM&q=logo';
    mockFetch.mockResolvedValue({ data: [ev('1')], hasMore: false });
    renderPage();
    await screen.findByText('Title 1');
    expect(mockFetch.mock.calls[0][0]).toMatchObject({
      paginate: 'cursor',
      status: 'active',
      assetCode: 'XLM',
      search: 'logo',
    });
  });

  it('writes filter changes to the URL', async () => {
    mockFetch.mockResolvedValue({ data: [ev('1')], hasMore: false });
    renderPage();
    await screen.findByText('Title 1');
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'completed');
    expect(replace).toHaveBeenCalledWith('/transactions?status=completed', { scroll: false });
  });

  it('loads more using the next cursor', async () => {
    mockFetch
      .mockResolvedValueOnce({ data: [ev('1')], hasMore: true, nextCursor: '10' })
      .mockResolvedValueOnce({ data: [ev('2')], hasMore: false, nextCursor: null });
    renderPage();
    await screen.findByText('Title 1');
    await userEvent.click(screen.getByText('Load more'));
    expect(await screen.findByText('Title 2')).toBeInTheDocument();
    expect(mockFetch.mock.calls[1][0]).toMatchObject({ cursor: '10' });
    expect(screen.queryByText('Load more')).not.toBeInTheDocument();
  });

  it('exports the full filtered set as CSV', async () => {
    search = 'status=active';
    mockFetch.mockResolvedValue({ data: [ev('1')], hasMore: true, nextCursor: '1' });
    (fetchAllFilteredEvents as jest.Mock).mockResolvedValue([ev('1'), ev('2')]);
    renderPage();
    await screen.findByText('Title 1');
    await userEvent.click(screen.getByText('Export CSV'));
    await waitFor(() => expect(downloadCSV).toHaveBeenCalled());
    expect((fetchAllFilteredEvents as jest.Mock).mock.calls[0][0]).toMatchObject({ status: 'active' });
    expect((downloadCSV as jest.Mock).mock.calls[0][0]).toContain('escrow-2-aaaaaaaa');
  });
});
