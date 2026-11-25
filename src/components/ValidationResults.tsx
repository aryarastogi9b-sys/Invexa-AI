import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import type { ValidationCheck } from '../types/invoice.ts';

interface ValidationResultsProps {
  checks: ValidationCheck[];
}

export function ValidationResults({ checks }: ValidationResultsProps) {
  const failedOrWarn = checks.filter((c) => c.status !== 'PASS');
  const passed = checks.filter((c) => c.status === 'PASS');

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Deterministic Validation Rules
        </h3>
        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
          {passed.length} passed · {failedOrWarn.length} flagged
        </span>
      </div>

      <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 overflow-hidden">
        {checks.map((check) => {
          const isFail = check.status === 'FAIL';
          const isWarn = check.status === 'WARNING';

          return (
            <div key={check.rule_code} className="p-3.5 space-y-1.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  {isFail ? (
                    <XCircle
                      className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0"
                      aria-hidden="true"
                    />
                  ) : isWarn ? (
                    <AlertTriangle
                      className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0"
                      aria-hidden="true"
                    />
                  ) : (
                    <CheckCircle2
                      className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0"
                      aria-hidden="true"
                    />
                  )}
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                    {check.label}
                  </span>
                </div>
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400 shrink-0">
                  {check.rule_code}
                </span>
              </div>

              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed pl-6">
                {check.message}
              </p>

              {(isFail || isWarn) && (
                <div className="pl-6 pt-1 flex flex-wrap gap-x-6 gap-y-1 text-xs">
                  {check.expected_value !== null && (
                    <span className="text-slate-500 dark:text-slate-400">
                      Expected:{' '}
                      <span className="font-mono text-slate-900 dark:text-slate-100">
                        {check.expected_value}
                      </span>
                    </span>
                  )}
                  {check.observed_value !== null && (
                    <span className="text-slate-500 dark:text-slate-400">
                      Observed:{' '}
                      <span className="font-mono text-red-700 dark:text-red-300">
                        {check.observed_value}
                      </span>
                    </span>
                  )}
                  <span className="text-slate-600 dark:text-slate-300">
                    Next action: {check.review_guidance}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
