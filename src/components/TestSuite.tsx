import { CheckCircle2, Play, RotateCcw, Save, XCircle } from 'lucide-react';
import { useState } from 'react';
import type { PolicyConfig, ValidatorTestResult } from '../types/invoice.ts';

interface TestSuiteProps {
  policy: PolicyConfig;
  onPolicySaved: (policy: PolicyConfig) => void;
  onDemoReset: () => Promise<void>;
}

export function TestSuite({ policy, onPolicySaved, onDemoReset }: TestSuiteProps) {
  const [threshold, setThreshold] = useState(policy.approval_threshold);
  const [tolerance, setTolerance] = useState(policy.arithmetic_tolerance);
  const [duplicateCheck, setDuplicateCheck] = useState(policy.duplicate_check_enabled);
  const [requireInvNum, setRequireInvNum] = useState(policy.require_invoice_number);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [policySavedMsg, setPolicySavedMsg] = useState<string | null>(null);

  const [testResults, setTestResults] = useState<ValidatorTestResult[] | null>(null);
  const [runningTests, setRunningTests] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSavePolicy(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPolicySavedMsg(null);
    setSavingPolicy(true);
    try {
      const res = await fetch('/api/policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approval_threshold: threshold,
          arithmetic_tolerance: tolerance,
          duplicate_check_enabled: duplicateCheck,
          require_invoice_number: requireInvNum,
        }),
      });
      const payload = (await res.json()) as { policy?: PolicyConfig; error?: string };
      if (!res.ok || !payload.policy) {
        throw new Error(payload.error || 'Failed to update policy.');
      }
      onPolicySaved(payload.policy);
      setPolicySavedMsg('Validation policy updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update policy.');
    } finally {
      setSavingPolicy(false);
    }
  }

  async function handleRunTests() {
    setError(null);
    setRunningTests(true);
    try {
      const res = await fetch('/api/validator/run-tests', { method: 'POST' });
      const payload = (await res.json()) as { results?: ValidatorTestResult[]; error?: string };
      if (!res.ok || !payload.results) {
        throw new Error(payload.error || 'Failed to execute validator tests.');
      }
      setTestResults(payload.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute tests.');
    } finally {
      setRunningTests(false);
    }
  }

  async function handleReset() {
    setResetting(true);
    setError(null);
    try {
      await onDemoReset();
      setPolicySavedMsg('Demo records restored.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset demo data.');
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Validation Policy &amp; Test Suite
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
          Configure deterministic approval limits and run the automated acceptance tests against the backend Decimal rules engine.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3.5 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-xs text-red-900 dark:text-red-200"
        >
          {error}
        </div>
      )}

      {/* Policy form */}
      <form
        onSubmit={(e) => void handleSavePolicy(e)}
        className="border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 p-5 space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Deterministic Policy Rules
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Applied identically to every newly uploaded or corrected invoice.
            </p>
          </div>
          {policySavedMsg && (
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
              {policySavedMsg}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300 block">
              Approval Threshold (USD equivalent)
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            />
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              Invoices above this amount route to an authorized senior approver.
            </span>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300 block">
              Arithmetic Rounding Tolerance
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              max="10"
              value={tolerance}
              onChange={(e) => setTolerance(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            />
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              Maximum rounding variance allowed before flagging TOTAL_MISMATCH.
            </span>
          </label>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 pt-1">
          <label className="inline-flex items-center gap-2 text-xs text-slate-800 dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={duplicateCheck}
              onChange={(e) => setDuplicateCheck(e.target.checked)}
              className="rounded border-slate-300 text-blue-600"
            />
            <span>Flag matching normalized Vendor + Invoice Number as possible duplicates</span>
          </label>

          <label className="inline-flex items-center gap-2 text-xs text-slate-800 dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={requireInvNum}
              onChange={(e) => setRequireInvNum(e.target.checked)}
              className="rounded border-slate-300 text-blue-600"
            />
            <span>Require invoice number for automatic eligibility</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="submit"
            disabled={savingPolicy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{savingPolicy ? 'Saving...' : 'Save Policy'}</span>
          </button>

          <button
            type="button"
            disabled={resetting}
            onClick={() => void handleReset()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{resetting ? 'Resetting...' : 'Reset Demo Records'}</span>
          </button>
        </div>
      </form>

      {/* Deterministic Rules Engine Test Runner */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Deterministic Validator Acceptance Tests
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Exercises valid arithmetic, +60.00 mismatch, missing invoice number, duplicate detection, uncertain scan, and threshold routing.
            </p>
          </div>
          <button
            type="button"
            disabled={runningTests}
            onClick={() => void handleRunTests()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium hover:opacity-90 disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Play className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{runningTests ? 'Running Suite...' : 'Run All 6 Tests'}</span>
          </button>
        </div>

        {testResults && (
          <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            {testResults.map((tr) => (
              <div key={tr.name} className="p-3.5 flex items-start justify-between gap-4">
                <div className="flex items-start gap-2.5 min-w-0">
                  {tr.passed ? (
                    <CheckCircle2
                      className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0"
                      aria-hidden="true"
                    />
                  ) : (
                    <XCircle
                      className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0"
                      aria-hidden="true"
                    />
                  )}
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {tr.name}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{tr.scenario}</p>
                    <p className="text-xs font-mono text-slate-500 dark:text-slate-400 pt-0.5">
                      {tr.details}
                    </p>
                  </div>
                </div>
                <span className="font-mono text-xs shrink-0 text-slate-700 dark:text-slate-300">
                  {tr.passed ? 'PASS' : 'FAIL'} · {tr.actual_status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
