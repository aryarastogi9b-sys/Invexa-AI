import {
  FileUp,
  LayoutDashboard,
  ListChecks,
  Menu,
  Palette,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Dashboard } from './components/Dashboard.tsx';
import { InvoiceDetails } from './components/InvoiceDetails.tsx';
import { InvoiceUpload } from './components/InvoiceUpload.tsx';
import { ReviewQueue } from './components/ReviewQueue.tsx';
import { TestSuite } from './components/TestSuite.tsx';
import type { InvoiceRecord, PolicyConfig } from './types/invoice.ts';

type ViewKey = 'overview' | 'upload' | 'queue' | 'details' | 'tests';
type ContrastTheme = 'navy' | 'forest' | 'slate-dark';

const THEME_CONFIG: Record<
  ContrastTheme,
  {
    label: string;
    isDark: boolean;
    sidebarClass: string;
    sidebarBorderClass: string;
    brandTextClass: string;
    navIdleClass: string;
    navActiveClass: string;
    themeButtonIdleClass: string;
    themeButtonActiveClass: string;
    swatchClass: string;
  }
> = {
  navy: {
    label: 'Navy & Paper',
    isDark: false,
    sidebarClass: 'bg-[#0B1220] text-slate-100',
    sidebarBorderClass: 'border-slate-800',
    brandTextClass: 'text-white',
    navIdleClass: 'text-slate-300 hover:text-white hover:bg-white/10',
    navActiveClass: 'bg-white text-[#0B1220] font-semibold shadow-sm',
    themeButtonIdleClass: 'text-slate-300 border-slate-700 hover:bg-white/10',
    themeButtonActiveClass: 'bg-blue-600 text-white border-blue-500 font-semibold',
    swatchClass: 'bg-[#0B1220]',
  },
  forest: {
    label: 'Forest & Ivory',
    isDark: false,
    sidebarClass: 'bg-[#07221B] text-emerald-50',
    sidebarBorderClass: 'border-emerald-900',
    brandTextClass: 'text-white',
    navIdleClass: 'text-emerald-100/80 hover:text-white hover:bg-white/10',
    navActiveClass: 'bg-[#ECFDF5] text-[#07221B] font-semibold shadow-sm',
    themeButtonIdleClass: 'text-emerald-100/80 border-emerald-800 hover:bg-white/10',
    themeButtonActiveClass: 'bg-emerald-500 text-slate-950 border-emerald-400 font-semibold',
    swatchClass: 'bg-[#07221B]',
  },
  'slate-dark': {
    label: 'Midnight Slate',
    isDark: true,
    sidebarClass: 'bg-slate-900 text-slate-100',
    sidebarBorderClass: 'border-slate-800',
    brandTextClass: 'text-white',
    navIdleClass: 'text-slate-300 hover:text-white hover:bg-slate-800',
    navActiveClass: 'bg-sky-400 text-slate-950 font-semibold shadow-sm',
    themeButtonIdleClass: 'text-slate-300 border-slate-700 hover:bg-slate-800',
    themeButtonActiveClass: 'bg-sky-400 text-slate-950 border-sky-300 font-semibold',
    swatchClass: 'bg-sky-400',
  },
};

export default function App() {
  const [view, setView] = useState<ViewKey>('overview');
  const [theme, setTheme] = useState<ContrastTheme>('navy');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [policy, setPolicy] = useState<PolicyConfig>({
    approval_threshold: '5000.00',
    arithmetic_tolerance: '0.01',
    duplicate_check_enabled: true,
    require_invoice_number: true,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const activeTheme = THEME_CONFIG[theme];

  useEffect(() => {
    const root = document.documentElement;
    if (activeTheme.isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [activeTheme.isDark]);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/invoices');
      const data = (await res.json()) as {
        invoices?: InvoiceRecord[];
        policy?: PolicyConfig;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load invoices.');
      }
      setInvoices(data.invoices ?? []);
      if (data.policy) setPolicy(data.policy);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to reach backend.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchInvoices();
  }, [fetchInvoices]);

  const selectedInvoice = invoices.find((i) => i.id === selectedId) ?? null;

  function navigateTo(nextView: ViewKey) {
    setView(nextView);
    setMobileMenuOpen(false);
  }

  function handleSelectInvoice(id: string) {
    setSelectedId(id);
    setView('details');
    setMobileMenuOpen(false);
  }

  function handleAnalyzed(invoice: InvoiceRecord) {
    setInvoices((prev) => [invoice, ...prev.filter((i) => i.id !== invoice.id)]);
    setSelectedId(invoice.id);
    setView('details');
  }

  function handleUpdated(updated: InvoiceRecord) {
    setInvoices((prev) => prev.map((inv) => (inv.id === updated.id ? updated : inv)));
  }

  async function handleDeleteInvoice(id: string) {
    try {
      const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
      if (!res.ok) return;
      setInvoices((prev) => prev.filter((i) => i.id !== id));
      if (selectedId === id) {
        setSelectedId(null);
        setView('queue');
      }
    } catch {
      // ignore network error
    }
  }

  async function handleDemoReset() {
    const res = await fetch('/api/invoices/reset-demo', { method: 'POST' });
    const data = (await res.json()) as {
      invoices?: InvoiceRecord[];
      policy?: PolicyConfig;
      error?: string;
    };
    if (!res.ok) {
      throw new Error(data.error || 'Failed to reset demo data.');
    }
    setInvoices(data.invoices ?? []);
    if (data.policy) setPolicy(data.policy);
    setSelectedId(null);
  }

  const pendingReviewCount = invoices.filter((i) => i.status === 'NEEDS_REVIEW').length;

  const navItems: Array<{
    key: 'overview' | 'upload' | 'queue' | 'tests';
    label: string;
    icon: typeof LayoutDashboard;
    count?: number;
  }> = [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'upload', label: 'Upload Invoice', icon: FileUp },
    { key: 'queue', label: 'Review Queue', icon: ListChecks, count: pendingReviewCount },
    { key: 'tests', label: 'Policy & Tests', icon: SlidersHorizontal },
  ];

  const breadcrumbLabel =
    view === 'overview'
      ? 'Overview'
      : view === 'upload'
      ? 'Upload Invoice'
      : view === 'queue'
      ? 'Review Queue'
      : view === 'details'
      ? 'Invoice Inspector'
      : 'Policy & Tests';

  const sidebarContent = (
    <div className="flex flex-col h-full justify-between p-4 gap-6">
      <div className="space-y-6">
        {/* Wordmark */}
        <div className="flex items-center justify-between px-2 pt-1">
          <button
            type="button"
            onClick={() => navigateTo('overview')}
            className={`text-lg font-bold tracking-tight whitespace-nowrap shrink-0 cursor-pointer ${activeTheme.brandTextClass}`}
          >
            Invexa AI
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation menu"
            className="lg:hidden p-1.5 rounded-md opacity-80 hover:opacity-100 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Navigation Menu Options */}
        <nav aria-label="Primary navigation" className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              view === item.key || (view === 'details' && item.key === 'queue');
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => navigateTo(item.key)}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                  isActive ? activeTheme.navActiveClass : activeTheme.navIdleClass
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                </span>
                {typeof item.count === 'number' && item.count > 0 && (
                  <span className="font-mono text-xs tabular-nums opacity-85">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Contrasting Color Menu Options */}
      <div className={`pt-4 border-t ${activeTheme.sidebarBorderClass} space-y-2.5`}>
        <div className="flex items-center gap-2 px-1 text-xs font-medium opacity-75">
          <Palette className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Menu Contrast</span>
        </div>
        <div className="grid grid-cols-1 gap-1.5">
          {(Object.keys(THEME_CONFIG) as ContrastTheme[]).map((key) => {
            const cfg = THEME_CONFIG[key];
            const active = theme === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTheme(key)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md border text-xs transition-colors whitespace-nowrap cursor-pointer ${
                  active ? cfg.themeButtonActiveClass : activeTheme.themeButtonIdleClass
                }`}
              >
                <span>{cfg.label}</span>
                <span
                  className={`h-3 w-3 rounded-sm border border-white/30 shrink-0 ${cfg.swatchClass}`}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Desktop contrasting sidebar */}
      <aside
        className={`hidden lg:block w-64 shrink-0 border-r ${activeTheme.sidebarClass} ${activeTheme.sidebarBorderClass}`}
      >
        <div className="sticky top-0 h-screen">{sidebarContent}</div>
      </aside>

      {/* Mobile slide-over menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside
            className={`relative z-50 w-64 max-w-[80vw] h-full ${activeTheme.sidebarClass}`}
          >
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract */}
        <header className="h-14 px-4 sm:px-8 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              <Menu className="h-4 w-4" aria-hidden="true" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                Invexa AI
              </span>
              <span className="text-slate-400" aria-hidden="true">
                /
              </span>
              <span className="text-slate-600 dark:text-slate-400 truncate">
                {breadcrumbLabel}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigateTo('upload')}
            className="px-3.5 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
          >
            Upload Invoice
          </button>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-8 max-w-6xl w-full mx-auto">
          {loadError && (
            <div
              role="alert"
              className="mb-6 p-4 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-xs text-red-900 dark:text-red-200"
            >
              {loadError}
            </div>
          )}

          {view === 'overview' && (
            <Dashboard
              invoices={invoices}
              loading={loading}
              onSelectInvoice={handleSelectInvoice}
              onNavigate={(target) => navigateTo(target)}
            />
          )}

          {view === 'upload' && <InvoiceUpload onAnalyzed={handleAnalyzed} />}

          {view === 'queue' && (
            <ReviewQueue
              invoices={invoices}
              loading={loading}
              onSelectInvoice={handleSelectInvoice}
              onDeleteInvoice={handleDeleteInvoice}
            />
          )}

          {view === 'details' && selectedInvoice && (
            <InvoiceDetails
              invoice={selectedInvoice}
              onBack={() => navigateTo('queue')}
              onUpdated={handleUpdated}
              onSelectInvoice={handleSelectInvoice}
            />
          )}

          {view === 'details' && !selectedInvoice && (
            <div className="p-8 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 text-center space-y-3">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Select an invoice from the queue to inspect it.
              </p>
              <button
                type="button"
                onClick={() => navigateTo('queue')}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 cursor-pointer"
              >
                Go to Review Queue
              </button>
            </div>
          )}

          {view === 'tests' && (
            <TestSuite
              policy={policy}
              onPolicySaved={setPolicy}
              onDemoReset={handleDemoReset}
            />
          )}
        </main>
      </div>
    </div>
  );
}
