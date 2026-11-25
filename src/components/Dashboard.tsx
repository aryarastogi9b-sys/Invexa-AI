import { ArrowRight } from 'lucide-react';
import type { InvoiceRecord } from '../types/invoice.ts';
import { StatusBadge } from './StatusBadge.tsx';

interface DashboardProps {
  invoices: InvoiceRecord[];
  loading: boolean;
  onSelectInvoice: (id: string) => void;
  onNavigate: (view: 'upload' | 'queue' | 'tests') => void;
}

export function Dashboard({
  invoices,
  loading,
  onSelectInvoice,
  onNavigate,
}: DashboardProps) {
  const totalCount = invoices.length;
  const needsReviewCount = invoices.filter((i) => i.status === 'NEEDS_REVIEW').length;
  const validCount = invoices.filter((i) => i.status === 'VALID').length;
  const approvedValue = invoices
    .filter((i) => i.status === 'APPROVED')
    .reduce((acc, inv) => {
      const n = Number(inv.total ?? 0);
      return acc + (Number.isFinite(n) ? n : 0);
    }, 0);

  const recent = invoices.slice(0, 6);

  return (
    <div className="space-y-8">
      {/* Intro row */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 text-balance">
          Invoice Verification Overview
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
          Read intelligently with AI, validate deterministically with exact decimal arithmetic, and route exceptions for human approval.
        </p>
      </div>

      {/* Flat single-elevation KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
        <div className="p-5 space-y-1">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total Processed
          </p>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-50">
            {totalCount}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            All persisted records
          </p>
        </div>

        <div className="p-5 space-y-1">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Needs Human Review
          </p>
          <p className="text-2xl font-bold font-mono tabular-nums text-amber-700 dark:text-amber-400">
            {needsReviewCount}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Flagged by deterministic rules
          </p>
        </div>

        <div className="p-5 space-y-1">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Eligible for Approval
          </p>
          <p className="text-2xl font-bold font-mono tabular-nums text-sky-700 dark:text-sky-400">
            {validCount}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Valid, awaiting sign-off
          </p>
        </div>

        <div className="p-5 space-y-1">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Approved Total
          </p>
          <p className="text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
            ${approvedValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Human-authorized spend
          </p>
        </div>
      </div>

      {/* 3-step pipeline principle */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 space-y-1">
          <p className="text-xs font-mono text-slate-500 dark:text-slate-400">01. Document Understanding</p>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Structured AI Extraction</p>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Reads PDF, PNG, or JPEG invoices into typed fields while leaving missing values null.
          </p>
        </div>
        <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 space-y-1">
          <p className="text-xs font-mono text-slate-500 dark:text-slate-400">02. Exact Financial Code</p>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Deterministic Validation</p>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Recomputes line items, subtotals, taxes, duplicates, and limits with exact Decimal math.
          </p>
        </div>
        <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 space-y-1">
          <p className="text-xs font-mono text-slate-500 dark:text-slate-400">03. Explicit Accountability</p>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Valid ≠ Approved</p>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Arithmetic passing marks an invoice eligible; only a human reviewer records approval.
          </p>
        </div>
      </div>

      {/* Recent Invoices Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Recent Invoices
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('queue')}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Open full queue</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        <div className="border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 overflow-x-auto">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((row) => (
                <div
                  key={row}
                  className="h-10 rounded bg-slate-100 dark:bg-slate-800 animate-pulse"
                />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                No invoices processed yet
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Upload a PDF or image invoice, or run a synthetic test case to begin.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('upload')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
              >
                Upload First Invoice
              </button>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 px-4">Vendor</th>
                  <th className="py-2.5 px-4">Invoice #</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4 text-right">Total</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                {recent.map((inv) => {
                  const firstFlag = inv.validation_results.find((r) => r.status !== 'PASS');
                  return (
                    <tr
                      key={inv.id}
                      onClick={() => onSelectInvoice(inv.id)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                        <div>{inv.vendor_name || 'Unknown Vendor'}</div>
                        {firstFlag && (
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-normal truncate max-w-xs">
                            {firstFlag.message}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {inv.invoice_number || '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {inv.invoice_date || '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-right text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {inv.currency ?? ''} {inv.total ?? '—'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <StatusBadge status={inv.status} compact />
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
