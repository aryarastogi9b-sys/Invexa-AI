import { Download, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { InvoiceRecord, InvoiceStatus } from '../types/invoice.ts';
import { StatusBadge } from './StatusBadge.tsx';

interface ReviewQueueProps {
  invoices: InvoiceRecord[];
  loading: boolean;
  onSelectInvoice: (id: string) => void;
  onDeleteInvoice: (id: string) => Promise<void>;
}

const FILTER_TABS: Array<{ key: 'ALL' | InvoiceStatus; label: string }> = [
  { key: 'ALL', label: 'All' },
  { key: 'NEEDS_REVIEW', label: 'Needs Review' },
  { key: 'VALID', label: 'Eligible (Valid)' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
];

function safeCsvCell(value: string | null | undefined): string {
  const raw = String(value ?? '');
  const neutralized = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${neutralized.replace(/"/g, '""')}"`;
}

export function ReviewQueue({
  invoices,
  loading,
  onSelectInvoice,
  onDeleteInvoice,
}: ReviewQueueProps) {
  const [filter, setFilter] = useState<'ALL' | InvoiceStatus>('ALL');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (filter !== 'ALL' && inv.status !== filter) return false;
      if (q) {
        const hay = `${inv.vendor_name ?? ''} ${inv.invoice_number ?? ''} ${inv.filename}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [invoices, filter, search]);

  function handleExportCsv() {
    const headers = [
      'ID',
      'Vendor',
      'Invoice Number',
      'Date',
      'Currency',
      'Subtotal',
      'Tax',
      'Total',
      'Computed Total',
      'Validation Status',
      'Workflow Status',
      'Flag Summary',
    ];
    const rows = filtered.map((inv) => {
      const flagText = inv.validation_results
        .filter((r) => r.status !== 'PASS')
        .map((r) => `${r.rule_code}: ${r.message}`)
        .join(' | ');
      return [
        inv.id,
        inv.vendor_name,
        inv.invoice_number,
        inv.invoice_date,
        inv.currency,
        inv.subtotal,
        inv.tax_amount,
        inv.total,
        inv.computed_total,
        inv.validation_status,
        inv.status,
        flagText,
      ]
        .map(safeCsvCell)
        .join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invexa-invoices-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Review Queue
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Filter processed invoices, inspect exact validation findings, and record human approval decisions.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          disabled={filtered.length === 0}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Controls bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-800">
          {FILTER_TABS.map((tab) => {
            const count =
              tab.key === 'ALL'
                ? invoices.length
                : invoices.filter((i) => i.status === tab.key).length;
            const active = filter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {tab.label} ({count})
              </button>
            );
          })}
        </div>

        <div className="relative w-full lg:w-72">
          <Search
            className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendor or invoice #..."
            aria-label="Search invoices"
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>
      </div>

      {/* Table */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 overflow-x-auto">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-10 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
              No matching invoices
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Try clearing your search filter or upload a new invoice document.
            </p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-4">Vendor &amp; Reason</th>
                <th className="py-2.5 px-4">Invoice #</th>
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4 text-right">Document Total</th>
                <th className="py-2.5 px-4 text-right">Recomputed</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
              {filtered.map((inv) => {
                const flagged = inv.validation_results.filter((r) => r.status !== 'PASS');
                const reasonText =
                  flagged.length > 0
                    ? flagged[0].message
                    : 'All deterministic checks passed';

                return (
                  <tr
                    key={inv.id}
                    onClick={() => onSelectInvoice(inv.id)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {inv.vendor_name || 'Missing Vendor'}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-md">
                        {reasonText}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {inv.invoice_number || 'Missing'}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {inv.invoice_date || '—'}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-right text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {inv.currency ?? ''} {inv.total ?? '—'}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-right text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {inv.currency ?? ''} {inv.computed_total ?? '—'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <StatusBadge status={inv.status} compact />
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectInvoice(inv.id);
                          }}
                          className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                        >
                          Inspect
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete invoice ${inv.invoice_number || inv.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            void onDeleteInvoice(inv.id);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
