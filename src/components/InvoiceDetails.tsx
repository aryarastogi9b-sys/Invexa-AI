import {
  ArrowLeft,
  Check,
  Edit3,
  ExternalLink,
  FileText,
  Save,
  ShieldAlert,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { InvoiceRecord, LineItem } from '../types/invoice.ts';
import { StatusBadge } from './StatusBadge.tsx';
import { ValidationResults } from './ValidationResults.tsx';

interface InvoiceDetailsProps {
  invoice: InvoiceRecord;
  onBack: () => void;
  onUpdated: (updated: InvoiceRecord) => void;
  onSelectInvoice: (id: string) => void;
}

export function InvoiceDetails({
  invoice,
  onBack,
  onUpdated,
  onSelectInvoice,
}: InvoiceDetailsProps) {
  const [editing, setEditing] = useState(false);
  const [savingFields, setSavingFields] = useState(false);
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editable fields
  const [vendorName, setVendorName] = useState(invoice.vendor_name ?? '');
  const [invoiceNumber, setInvoiceNumber] = useState(invoice.invoice_number ?? '');
  const [invoiceDate, setInvoiceDate] = useState(invoice.invoice_date ?? '');
  const [currency, setCurrency] = useState(invoice.currency ?? 'USD');
  const [subtotal, setSubtotal] = useState(invoice.subtotal ?? '');
  const [taxAmount, setTaxAmount] = useState(invoice.tax_amount ?? '');
  const [total, setTotal] = useState(invoice.total ?? '');
  const [lineItems, setLineItems] = useState<LineItem[]>(invoice.line_items);

  // Human review form
  const [reviewerName, setReviewerName] = useState('A. Patel (Reviewer)');
  const [comment, setComment] = useState('');

  useEffect(() => {
    setEditing(false);
    setError(null);
    setVendorName(invoice.vendor_name ?? '');
    setInvoiceNumber(invoice.invoice_number ?? '');
    setInvoiceDate(invoice.invoice_date ?? '');
    setCurrency(invoice.currency ?? 'USD');
    setSubtotal(invoice.subtotal ?? '');
    setTaxAmount(invoice.tax_amount ?? '');
    setTotal(invoice.total ?? '');
    setLineItems(invoice.line_items);
    setComment('');
  }, [invoice]);

  async function handleSaveCorrections() {
    setError(null);
    setSavingFields(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/fields`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actor: reviewerName.trim() || 'Reviewer',
          vendor_name: vendorName.trim() || null,
          invoice_number: invoiceNumber.trim() || null,
          invoice_date: invoiceDate.trim() || null,
          currency: currency.trim().toUpperCase() || null,
          subtotal: subtotal.trim() || null,
          tax_amount: taxAmount.trim() || null,
          total: total.trim() || null,
          line_items: lineItems,
          extraction_uncertain: false,
        }),
      });
      const payload = (await res.json()) as { invoice?: InvoiceRecord; error?: string };
      if (!res.ok || !payload.invoice) {
        throw new Error(payload.error || 'Failed to save corrections.');
      }
      setEditing(false);
      onUpdated(payload.invoice);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save corrections.');
    } finally {
      setSavingFields(false);
    }
  }

  async function handleDecision(decision: 'APPROVED' | 'REJECTED' | 'CORRECTION_REQUESTED') {
    setError(null);
    if (!reviewerName.trim()) {
      setError('Enter your reviewer name before recording a decision.');
      return;
    }
    setSubmittingDecision(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewer_name: reviewerName.trim(),
          decision,
          comment: comment.trim(),
        }),
      });
      const payload = (await res.json()) as { invoice?: InvoiceRecord; error?: string };
      if (!res.ok || !payload.invoice) {
        throw new Error(payload.error || 'Failed to record decision.');
      }
      setComment('');
      onUpdated(payload.invoice);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record decision.');
    } finally {
      setSubmittingDecision(false);
    }
  }

  const fileUrl = `/api/invoices/${invoice.id}/file`;
  const isPdf = invoice.mime_type === 'application/pdf';

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Back to Queue</span>
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-50 truncate">
              {invoice.vendor_name || 'Unknown Vendor'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
              {invoice.invoice_number || 'No Invoice #'} · {invoice.filename}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right hidden sm:block">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              System Validation: <span className="font-mono">{invoice.validation_status}</span>
            </div>
          </div>
          <StatusBadge status={invoice.status} />
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3.5 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-xs text-red-900 dark:text-red-200"
        >
          {error}
        </div>
      )}

      {invoice.duplicate_of_id && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-xs text-amber-950 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              Possible duplicate detected matching existing record{' '}
              <span className="font-mono font-semibold">{invoice.duplicate_of_id}</span>.
            </span>
          </div>
          <button
            type="button"
            onClick={() => onSelectInvoice(invoice.duplicate_of_id!)}
            className="font-medium underline cursor-pointer whitespace-nowrap"
          >
            Inspect Existing Record
          </button>
        </div>
      )}

      {/* Side-by-side workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Source Document Preview */}
        <div className="lg:col-span-5 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="h-4 w-4 text-slate-500 shrink-0" aria-hidden="true" />
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                Source Document
              </span>
            </div>
            {invoice.has_file && (
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0"
              >
                <span>Open raw</span>
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            )}
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-950 flex items-center justify-center min-h-[420px]">
            {!invoice.has_file ? (
              <p className="text-xs text-slate-500">No document preview stored for this record.</p>
            ) : isPdf ? (
              <object
                data={fileUrl}
                type="application/pdf"
                className="w-full h-[540px] rounded border border-slate-200 dark:border-slate-800 bg-white"
              >
                <div className="p-6 text-center space-y-2">
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Inline PDF preview is unavailable in this browser view.
                  </p>
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-xs font-medium text-blue-600 underline"
                  >
                    Open PDF in new tab
                  </a>
                </div>
              </object>
            ) : (
              <img
                src={fileUrl}
                alt={`Invoice document for ${invoice.vendor_name || invoice.filename}`}
                className="max-w-full max-h-[580px] object-contain rounded border border-slate-200 dark:border-slate-800 bg-white"
              />
            )}
          </div>
        </div>

        {/* Right: Extracted Fields, Validation, Decision, Audit */}
        <div className="lg:col-span-7 space-y-6">
          {/* Extracted Fields */}
          <section className="border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Extracted Invoice Fields
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Corrections re-run deterministic decimal validation and log an audit event.
                </p>
              </div>
              {!editing ? (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Correct Fields</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={savingFields}
                    onClick={() => void handleSaveCorrections()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50 cursor-pointer whitespace-nowrap"
                  >
                    <Save className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{savingFields ? 'Validating...' : 'Save & Re-validate'}</span>
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-xs text-slate-500 dark:text-slate-400 block">Vendor Name</span>
                {editing ? (
                  <input
                    type="text"
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                ) : (
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {invoice.vendor_name || 'Null (Missing)'}
                  </div>
                )}
              </label>

              <label className="space-y-1">
                <span className="text-xs text-slate-500 dark:text-slate-400 block">Invoice Number</span>
                {editing ? (
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm font-mono rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                ) : (
                  <div className="text-sm font-mono text-slate-900 dark:text-slate-100">
                    {invoice.invoice_number || 'Null (Missing)'}
                  </div>
                )}
              </label>

              <label className="space-y-1">
                <span className="text-xs text-slate-500 dark:text-slate-400 block">Invoice Date</span>
                {editing ? (
                  <input
                    type="text"
                    placeholder="YYYY-MM-DD"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm font-mono rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                ) : (
                  <div className="text-sm font-mono text-slate-900 dark:text-slate-100">
                    {invoice.invoice_date || 'Null (Missing)'}
                  </div>
                )}
              </label>

              <label className="space-y-1">
                <span className="text-xs text-slate-500 dark:text-slate-400 block">Currency</span>
                {editing ? (
                  <input
                    type="text"
                    maxLength={3}
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm font-mono uppercase rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                ) : (
                  <div className="text-sm font-mono text-slate-900 dark:text-slate-100">
                    {invoice.currency || 'Null (Missing)'}
                  </div>
                )}
              </label>
            </div>

            {/* Line Items */}
            <div className="pt-2 space-y-2">
              <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Line Items ({lineItems.length})
              </h3>
              <div className="border border-slate-200 dark:border-slate-800 rounded overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                      <th className="py-2 px-3">Description</th>
                      <th className="py-2 px-3 text-right">Qty</th>
                      <th className="py-2 px-3 text-right">Unit Price</th>
                      <th className="py-2 px-3 text-right">Doc Amount</th>
                      <th className="py-2 px-3 text-right">Computed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {lineItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-4 px-3 text-center text-slate-500">
                          No line items extracted.
                        </td>
                      </tr>
                    ) : (
                      lineItems.map((item, idx) => (
                        <tr key={item.id}>
                          <td className="py-2 px-3 text-slate-900 dark:text-slate-100">
                            {editing ? (
                              <input
                                type="text"
                                value={item.description}
                                onChange={(e) => {
                                  const next = [...lineItems];
                                  next[idx] = { ...item, description: e.target.value };
                                  setLineItems(next);
                                }}
                                className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                              />
                            ) : (
                              item.description
                            )}
                          </td>
                          <td className="py-2 px-3 font-mono text-right text-slate-700 dark:text-slate-300">
                            {editing ? (
                              <input
                                type="text"
                                value={item.quantity ?? ''}
                                onChange={(e) => {
                                  const next = [...lineItems];
                                  next[idx] = { ...item, quantity: e.target.value };
                                  setLineItems(next);
                                }}
                                className="w-16 px-2 py-1 text-right rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                              />
                            ) : (
                              item.quantity ?? '—'
                            )}
                          </td>
                          <td className="py-2 px-3 font-mono text-right text-slate-700 dark:text-slate-300">
                            {editing ? (
                              <input
                                type="text"
                                value={item.unit_price ?? ''}
                                onChange={(e) => {
                                  const next = [...lineItems];
                                  next[idx] = { ...item, unit_price: e.target.value };
                                  setLineItems(next);
                                }}
                                className="w-24 px-2 py-1 text-right rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                              />
                            ) : (
                              item.unit_price ?? '—'
                            )}
                          </td>
                          <td
                            className={`py-2 px-3 font-mono text-right ${
                              item.matches === false
                                ? 'text-red-700 dark:text-red-400 font-semibold'
                                : 'text-slate-900 dark:text-slate-100'
                            }`}
                          >
                            {editing ? (
                              <input
                                type="text"
                                value={item.amount ?? ''}
                                onChange={(e) => {
                                  const next = [...lineItems];
                                  next[idx] = { ...item, amount: e.target.value };
                                  setLineItems(next);
                                }}
                                className="w-24 px-2 py-1 text-right rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                              />
                            ) : (
                              item.amount ?? '—'
                            )}
                          </td>
                          <td className="py-2 px-3 font-mono text-right text-slate-500 dark:text-slate-400">
                            {item.computed_amount ?? '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals comparison */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="space-y-1">
                <span className="text-xs text-slate-500 dark:text-slate-400 block">
                  Subtotal (Doc / Computed)
                </span>
                {editing ? (
                  <input
                    type="text"
                    value={subtotal}
                    onChange={(e) => setSubtotal(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm font-mono rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                ) : (
                  <div className="text-sm font-mono text-slate-900 dark:text-slate-100">
                    {invoice.subtotal ?? '—'}{' '}
                    <span className="text-xs text-slate-500">/ {invoice.computed_subtotal ?? '—'}</span>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <span className="text-xs text-slate-500 dark:text-slate-400 block">Tax Amount</span>
                {editing ? (
                  <input
                    type="text"
                    value={taxAmount}
                    onChange={(e) => setTaxAmount(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm font-mono rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                ) : (
                  <div className="text-sm font-mono text-slate-900 dark:text-slate-100">
                    {invoice.tax_amount ?? '0.00'}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <span className="text-xs text-slate-500 dark:text-slate-400 block">
                  Total (Doc / Computed)
                </span>
                {editing ? (
                  <input
                    type="text"
                    value={total}
                    onChange={(e) => setTotal(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm font-mono rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                ) : (
                  <div className="text-sm font-mono font-semibold text-slate-900 dark:text-slate-100">
                    {invoice.total ?? '—'}{' '}
                    <span className="text-xs font-normal text-slate-500">
                      / {invoice.computed_total ?? '—'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Deterministic Validation Rules */}
          <ValidationResults checks={invoice.validation_results} />

          {/* Human Approval Action */}
          <section className="border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 p-4 space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Human Review Decision
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                System status <span className="font-mono">VALID</span> means arithmetic and rules passed—it does not authorize payment. Record an explicit reviewer decision below.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 block">
                  Reviewer Name
                </span>
                <input
                  type="text"
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  placeholder="Full name or role"
                  className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 block">
                  Review Note
                </span>
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Optional justification or reason..."
                  className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                disabled={submittingDecision}
                onClick={() => void handleDecision('APPROVED')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Approve Invoice</span>
              </button>

              <button
                type="button"
                disabled={submittingDecision}
                onClick={() => void handleDecision('CORRECTION_REQUESTED')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-amber-400 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 text-xs font-medium hover:bg-amber-100 dark:hover:bg-amber-900/50 disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                <span>Hold for Correction</span>
              </button>

              <button
                type="button"
                disabled={submittingDecision}
                onClick={() => void handleDecision('REJECTED')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/50 text-red-800 dark:text-red-200 text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900/50 disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Reject Invoice</span>
              </button>
            </div>

            {invoice.review_decisions.length > 0 && (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Recorded Decisions
                </p>
                <div className="space-y-2">
                  {invoice.review_decisions.map((dec) => (
                    <div
                      key={dec.id}
                      className="text-xs flex flex-wrap items-baseline justify-between gap-2 text-slate-700 dark:text-slate-300"
                    >
                      <span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {dec.decision}
                        </span>{' '}
                        by {dec.reviewer_name} — {dec.comment}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {new Date(dec.created_at).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Audit Trail */}
          <section className="border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Audit Trail
            </h3>
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {invoice.audit_events.map((ev) => (
                <div
                  key={ev.id}
                  className="py-2 flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 text-xs"
                >
                  <div className="text-slate-700 dark:text-slate-300">
                    <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 mr-2">
                      {ev.event_type}
                    </span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {ev.actor}:
                    </span>{' '}
                    {ev.details}
                  </div>
                  <span className="font-mono text-[11px] text-slate-500 shrink-0">
                    {new Date(ev.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
