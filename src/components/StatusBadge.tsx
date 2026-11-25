import { AlertTriangle, CheckCircle2, Clock, ShieldCheck, XCircle } from 'lucide-react';
import type { InvoiceStatus } from '../types/invoice.ts';

interface StatusBadgeProps {
  status: InvoiceStatus;
  compact?: boolean;
}

const STATUS_META: Record<
  InvoiceStatus,
  {
    label: string;
    classes: string;
    icon: typeof CheckCircle2;
  }
> = {
  PROCESSING: {
    label: 'Processing',
    classes:
      'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
    icon: Clock,
  },
  VALID: {
    label: 'Eligible (Valid)',
    classes:
      'bg-sky-50 text-sky-900 border-sky-200 dark:bg-sky-950/60 dark:text-sky-200 dark:border-sky-800',
    icon: CheckCircle2,
  },
  NEEDS_REVIEW: {
    label: 'Needs Review',
    classes:
      'bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800',
    icon: AlertTriangle,
  },
  APPROVED: {
    label: 'Approved',
    classes:
      'bg-emerald-50 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800',
    icon: ShieldCheck,
  },
  REJECTED: {
    label: 'Rejected',
    classes:
      'bg-red-50 text-red-900 border-red-300 dark:bg-red-950/60 dark:text-red-200 dark:border-red-800',
    icon: XCircle,
  },
};

export function StatusBadge({ status, compact = false }: StatusBadgeProps) {
  const meta = STATUS_META[status] ?? STATUS_META.PROCESSING;
  const Icon = meta.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border font-medium whitespace-nowrap shrink-0 ${
        compact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
      } ${meta.classes}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{meta.label}</span>
    </span>
  );
}
