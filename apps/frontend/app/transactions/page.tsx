"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Download, Filter, Calendar, ExternalLink, Loader2, TrendingUp, TrendingDown, Wallet, Search, AlertTriangle } from "lucide-react";
import { IEventResponse } from "@/lib/escrow-api";
import { convertEventsToCSV, downloadCSV, generateTransactionFilename } from "@/lib/csv-export";
import {
  EMPTY_HISTORY_FILTERS,
  HistoryFilters,
  fetchAllFilteredEvents,
  hasActiveFilters,
  parseHistoryFilters,
  serializeHistoryFilters,
} from "@/lib/history-filters";
import { useTransactionHistory } from "@/hooks/useTransactionHistory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/useToast";
import { TransactionTableSkeleton } from "@/components/ui/TransactionTableSkeleton";
import { escrowStatusLabel } from '@/utils/escrowStatus';

const EVENT_TYPES = [
  { value: "", label: "All Events" },
  { value: "funded", label: "Funding" },
  { value: "completed", label: "Release" },
  { value: "cancelled", label: "Refund" },
  { value: "disputed", label: "Dispute" },
  { value: "dispute_filed", label: "Dispute Filed" },
  { value: "dispute_resolved", label: "Dispute Resolved" },
  { value: "created", label: "Created" },
  { value: "expired", label: "Expired" },
];

const STATUSES = [
  { value: "", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "disputed", label: "Disputed" },
  { value: "expired", label: "Expired" },
  { value: "refunded", label: "Refunded" },
];

const SEARCH_DEBOUNCE_MS = 300;

export default function TransactionsPage() {
  return (
    <Suspense fallback={<TransactionTableSkeleton />}>
      <TransactionsView />
    </Suspense>
  );
}

function TransactionsView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { success, error } = useToast();

  // The URL query string is the source of truth for filters.
  const filters = useMemo(() => parseHistoryFilters(searchParams), [searchParams]);
  const [searchInput, setSearchInput] = useState(filters.search);
  const [isExporting, setIsExporting] = useState(false);

  const updateFilters = (patch: Partial<HistoryFilters>) => {
    const qs = serializeHistoryFilters({ ...filters, ...patch });
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  // Keep the input in sync with back/forward navigation and "Clear".
  useEffect(() => {
    setSearchInput(filters.search);
  }, [filters.search]);

  // Debounce text search into the URL.
  useEffect(() => {
    if (searchInput.trim() === filters.search) return;
    const timer = setTimeout(() => updateFilters({ search: searchInput.trim() }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useTransactionHistory(filters);

  const events: IEventResponse[] = useMemo(() => data?.pages.flatMap((p) => p.data) ?? [], [data]);

  const totals = useMemo(() => {
    let funded = 0;
    let released = 0;
    events.forEach((event) => {
      const amount = Number(event.escrow?.amount || 0);
      if (event.eventType.toUpperCase() === "FUNDED") funded += amount;
      else if (event.eventType.toUpperCase() === "COMPLETED") released += amount;
    });
    return { totalFunded: funded, totalReleased: released, totalInEscrow: funded - released };
  }, [events]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const all = await fetchAllFilteredEvents(filters);
      downloadCSV(convertEventsToCSV(all), generateTransactionFilename("csv"));
      success(`Successfully exported ${all.length} transactions to CSV`);
    } catch (err) {
      error("Failed to export transactions");
      console.error("Export error:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const clearFilters = () => {
    setSearchInput("");
    updateFilters(EMPTY_HISTORY_FILTERS);
  };

  const getEventTypeColor = (eventType: string) => {
    switch (eventType.toUpperCase()) {
      case "FUNDED":
        return "bg-blue-100 text-blue-800";
      case "COMPLETED":
        return "bg-green-100 text-green-800";
      case "CANCELLED":
        return "bg-red-100 text-red-800";
      case "DISPUTED":
      case "DISPUTE_FILED":
        return "bg-yellow-100 text-yellow-800";
      case "DISPUTE_RESOLVED":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatEventType = (eventType: string) => {
    return eventType.replace(/_/g, " ").toLowerCase();
  };

  const getExplorerUrl = (txHash: string) => {
    if (!txHash) return "";
    return `https://stellar.expert/explorer/testnet/tx/${txHash}`;
  };

  const selectClass =
    "w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="min-h-screen bg-background text-foreground py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Transaction History</h1>
          <p className="text-muted-foreground">View and export all your escrow-related transactions</p>
        </div>

        {/* Running Totals */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-card rounded-lg shadow p-6 border-l-4 border-blue-500 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Funded (loaded)</p>
                <p className="text-2xl font-bold text-foreground">
                  {totals.totalFunded.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 7,
                  })}{" "}
                  XLM
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-card rounded-lg shadow p-6 border-l-4 border-green-500 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Released (loaded)</p>
                <p className="text-2xl font-bold text-foreground">
                  {totals.totalReleased.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 7,
                  })}{" "}
                  XLM
                </p>
              </div>
              <TrendingDown className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className="bg-card rounded-lg shadow p-6 border-l-4 border-orange-500 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">In Escrow (loaded)</p>
                <p className="text-2xl font-bold text-foreground">
                  {totals.totalInEscrow.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 7,
                  })}{" "}
                  XLM
                </p>
              </div>
              <Wallet className="w-8 h-8 text-orange-500" />
            </div>
          </div>
        </div>

        {/* Filters and Actions */}
        <div className="bg-card rounded-lg shadow p-4 mb-6 border border-border">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-[2] min-w-[220px]">
              <label htmlFor="history-search" className="text-sm font-medium text-foreground mb-1 block">Search</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="history-search"
                  type="search"
                  placeholder="Escrow title or ID"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="text-sm pl-9"
                />
              </div>
            </div>

            <div className="flex-1 min-w-[160px]">
              <label htmlFor="history-status" className="text-sm font-medium text-foreground mb-1 block">Status</label>
              <select id="history-status" value={filters.status} onChange={(e) => updateFilters({ status: e.target.value })} className={selectClass}>
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[120px]">
              <label htmlFor="history-asset" className="text-sm font-medium text-foreground mb-1 block">Asset</label>
              <Input
                id="history-asset"
                placeholder="e.g. XLM"
                value={filters.asset}
                maxLength={12}
                onChange={(e) => updateFilters({ asset: e.target.value.toUpperCase() })}
                className="text-sm"
              />
            </div>

            <div className="flex-1 min-w-[180px]">
              <label htmlFor="history-type" className="text-sm font-medium text-foreground mb-1 block">Event Type</label>
              <select id="history-type" value={filters.eventType} onChange={(e) => updateFilters({ eventType: e.target.value })} className={selectClass}>
                {EVENT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[160px]">
              <label htmlFor="history-from" className="text-sm font-medium text-foreground mb-1 block">From Date</label>
              <Input id="history-from" type="date" value={filters.dateFrom} onChange={(e) => updateFilters({ dateFrom: e.target.value })} className="text-sm" />
            </div>

            <div className="flex-1 min-w-[160px]">
              <label htmlFor="history-to" className="text-sm font-medium text-foreground mb-1 block">To Date</label>
              <Input id="history-to" type="date" value={filters.dateTo} onChange={(e) => updateFilters({ dateTo: e.target.value })} className="text-sm" />
            </div>

            <Button variant="outline" onClick={clearFilters} disabled={!hasActiveFilters(filters) && !searchInput} className="flex items-center gap-1">
              <Filter className="w-4 h-4" />
              Clear
            </Button>

            <Button onClick={handleExport} disabled={isLoading || isError || events.length === 0 || isExporting} className="flex items-center gap-1">
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Export CSV
            </Button>
          </div>
        </div>

        {/* Transaction Table */}
        <div className="bg-card rounded-lg shadow overflow-hidden border border-border">
          {isLoading ? (
            <TransactionTableSkeleton />
          ) : isError ? (
            <div role="alert" className="text-center py-16">
              <AlertTriangle className="w-16 h-16 mx-auto text-red-500 mb-4" />
              <p className="text-foreground text-lg">Failed to load transactions</p>
              <p className="text-muted-foreground text-sm mt-1 mb-4">Something went wrong while fetching your history.</p>
              <Button variant="outline" onClick={() => refetch()}>Try again</Button>
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-16">
              <Calendar className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-foreground text-lg">No transactions found</p>
              <p className="text-muted-foreground text-sm mt-1">Try adjusting your filters or date range</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Escrow</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Event Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Tx Hash</th>
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-border">
                    {events.map((event) => {
                      const txHash = event.data?.transactionHash || event.data?.stellarTxHash;

                      return (
                        <tr key={event.id} className="hover:bg-accent/50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                            {new Date(event.createdAt).toLocaleDateString()}
                            <div className="text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleTimeString()}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-foreground">{event.escrow?.title || "Unknown"}</div>
                            <div className="text-xs text-muted-foreground font-mono">{event.escrowId.slice(0, 8)}...</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge className={getEventTypeColor(event.eventType)}>{formatEventType(event.eventType)}</Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                            {event.escrow ? (
                              <div>
                                <div className="font-medium">
                                  {Number(event.escrow.amount).toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 7,
                                  })}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {event.escrow.assetIssuer ? `${event.escrow.assetCode}:${event.escrow.assetIssuer.slice(0, 8)}...` : event.escrow.assetCode}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">N/A</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge
                              className={
                                event.escrow?.status === "COMPLETED"
                                  ? "bg-green-100 text-green-800"
                                  : event.escrow?.status === "ACTIVE"
                                    ? "bg-blue-100 text-blue-800"
                                    : event.escrow?.status === "CANCELLED"
                                      ? "bg-red-100 text-red-800"
                                      : "bg-gray-100 text-gray-800"
                              }
                            >
                              {event.escrow ? escrowStatusLabel(event.escrow.status) : "N/A"}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {txHash ? (
                              <a
                                href={getExplorerUrl(txHash)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                              >
                                <span className="font-mono text-xs">{txHash.slice(0, 8)}...</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-muted-foreground">N/A</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="bg-muted/50 px-6 py-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-foreground">
                    Showing <span className="font-medium">{events.length}</span> transactions
                  </div>
                  {hasNextPage && (
                    <Button variant="outline" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                      {isFetchingNextPage ? "Loading..." : "Load more"}
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
