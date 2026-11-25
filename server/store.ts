import fs from 'fs';
import path from 'path';
import type { InvoiceRecord, PolicyConfig } from '../src/types/invoice.ts';
import { validateInvoiceData } from './validator.ts';

interface DatabaseState {
  policy: PolicyConfig;
  invoices: InvoiceRecord[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.resolve(DATA_DIR, 'invexa-db.json');
const FILES_DIR = path.resolve(DATA_DIR, 'files');

const DEFAULT_POLICY: PolicyConfig = {
  approval_threshold: '5000.00',
  arithmetic_tolerance: '0.01',
  duplicate_check_enabled: true,
  require_invoice_number: true,
};

function createSyntheticSvgInvoice(opts: {
  vendor: string;
  address: string;
  invoiceNumber: string | null;
  date: string;
  currency: string;
  lines: Array<{ desc: string; qty: string; unit: string; amt: string }>;
  subtotal: string;
  tax: string;
  total: string;
  note?: string;
}): string {
  const rows = opts.lines
    .map(
      (l, i) => `
    <text x="48" y="${268 + i * 32}" font-family="sans-serif" font-size="13" fill="#0f172a">${escapeXml(l.desc)}</text>
    <text x="360" y="${268 + i * 32}" font-family="monospace" font-size="13" text-anchor="end" fill="#334155">${escapeXml(l.qty)}</text>
    <text x="455" y="${268 + i * 32}" font-family="monospace" font-size="13" text-anchor="end" fill="#334155">${escapeXml(l.unit)}</text>
    <text x="552" y="${268 + i * 32}" font-family="monospace" font-size="13" text-anchor="end" fill="#0f172a">${escapeXml(l.amt)}</text>
    <line x1="48" y1="${278 + i * 32}" x2="552" y2="${278 + i * 32}" stroke="#e2e8f0" stroke-width="1"/>`
    )
    .join('');

  const summaryY = 290 + opts.lines.length * 32;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="520" viewBox="0 0 600 520">
  <rect width="600" height="520" fill="#ffffff"/>
  <rect x="0" y="0" width="600" height="8" fill="#0f172a"/>
  <text x="48" y="56" font-family="sans-serif" font-size="22" font-weight="700" fill="#0f172a">${escapeXml(opts.vendor)}</text>
  <text x="48" y="78" font-family="sans-serif" font-size="12" fill="#64748b">${escapeXml(opts.address)}</text>
  <text x="552" y="56" font-family="sans-serif" font-size="18" font-weight="700" text-anchor="end" fill="#334155">INVOICE</text>
  <text x="552" y="78" font-family="monospace" font-size="12" text-anchor="end" fill="#475569">No: ${escapeXml(opts.invoiceNumber ?? '[MISSING]')}</text>
  <text x="552" y="96" font-family="monospace" font-size="12" text-anchor="end" fill="#475569">Date: ${escapeXml(opts.date)}</text>
  <text x="552" y="114" font-family="monospace" font-size="12" text-anchor="end" fill="#475569">Currency: ${escapeXml(opts.currency)}</text>
  <line x1="48" y1="145" x2="552" y2="145" stroke="#cbd5e1" stroke-width="1"/>
  <text x="48" y="172" font-family="sans-serif" font-size="11" font-weight="600" fill="#64748b">BILL TO</text>
  <text x="48" y="190" font-family="sans-serif" font-size="13" font-weight="600" fill="#0f172a">Invexa Accounts Payable Demo</text>
  <rect x="48" y="216" width="504" height="28" fill="#f1f5f9"/>
  <text x="56" y="234" font-family="sans-serif" font-size="11" font-weight="600" fill="#334155">DESCRIPTION</text>
  <text x="360" y="234" font-family="sans-serif" font-size="11" font-weight="600" text-anchor="end" fill="#334155">QTY</text>
  <text x="455" y="234" font-family="sans-serif" font-size="11" font-weight="600" text-anchor="end" fill="#334155">UNIT</text>
  <text x="544" y="234" font-family="sans-serif" font-size="11" font-weight="600" text-anchor="end" fill="#334155">AMOUNT</text>
  ${rows}
  <text x="430" y="${summaryY}" font-family="sans-serif" font-size="13" text-anchor="end" fill="#475569">Subtotal</text>
  <text x="552" y="${summaryY}" font-family="monospace" font-size="13" text-anchor="end" fill="#0f172a">${escapeXml(opts.currency)} ${escapeXml(opts.subtotal)}</text>
  <text x="430" y="${summaryY + 24}" font-family="sans-serif" font-size="13" text-anchor="end" fill="#475569">Tax</text>
  <text x="552" y="${summaryY + 24}" font-family="monospace" font-size="13" text-anchor="end" fill="#0f172a">${escapeXml(opts.currency)} ${escapeXml(opts.tax)}</text>
  <line x1="360" y1="${summaryY + 36}" x2="552" y2="${summaryY + 36}" stroke="#0f172a" stroke-width="1.5"/>
  <text x="430" y="${summaryY + 56}" font-family="sans-serif" font-size="15" font-weight="700" text-anchor="end" fill="#0f172a">Total Due</text>
  <text x="552" y="${summaryY + 56}" font-family="monospace" font-size="15" font-weight="700" text-anchor="end" fill="#0f172a">${escapeXml(opts.currency)} ${escapeXml(opts.total)}</text>
  ${opts.note ? `<text x="48" y="485" font-family="sans-serif" font-size="11" fill="#64748b">${escapeXml(opts.note)}</text>` : ''}
</svg>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function ensureDirs(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR, { recursive: true });
}

export function buildDemoSeed(): DatabaseState {
  ensureDirs();
  const policy = { ...DEFAULT_POLICY };
  const now = new Date();
  const iso = (minsAgo: number) => new Date(now.getTime() - minsAgo * 60000).toISOString();

  // Record 1: Needs Review (+60.00 Total Mismatch)
  const rec1Id = 'inv-demo-1001';
  const rec1Input = {
    id: rec1Id,
    vendor_name: 'Meridian Office Supply',
    invoice_number: 'MOS-2026-4412',
    invoice_date: '2026-11-18',
    currency: 'USD',
    line_items: [
      { id: 'l1', description: 'Ergonomic Task Chairs', quantity: '4', unit_price: '200.00', amount: '800.00' },
      { id: 'l2', description: 'USB-C Docking Stations', quantity: '2', unit_price: '100.00', amount: '200.00' },
    ],
    subtotal: '1000.00',
    tax_amount: '180.00',
    total: '1240.00',
  };
  const val1 = validateInvoiceData(rec1Input, [], policy);
  fs.writeFileSync(
    path.resolve(FILES_DIR, `${rec1Id}.svg`),
    createSyntheticSvgInvoice({
      vendor: 'Meridian Office Supply',
      address: '420 Harbor Parkway, Seattle, WA',
      invoiceNumber: 'MOS-2026-4412',
      date: '2026-11-18',
      currency: 'USD',
      lines: [
        { desc: 'Ergonomic Task Chairs', qty: '4', unit: '200.00', amt: '800.00' },
        { desc: 'USB-C Docking Stations', qty: '2', unit: '100.00', amt: '200.00' },
      ],
      subtotal: '1000.00',
      tax: '180.00',
      total: '1240.00',
      note: 'Synthetic test case: total is +60.00 higher than subtotal + tax.',
    })
  );

  const rec1: InvoiceRecord = {
    id: rec1Id,
    filename: 'meridian_mos_4412.svg',
    mime_type: 'image/svg+xml',
    has_file: true,
    vendor_name: rec1Input.vendor_name,
    invoice_number: rec1Input.invoice_number,
    invoice_date: rec1Input.invoice_date,
    currency: rec1Input.currency,
    line_items: val1.normalized_line_items,
    subtotal: rec1Input.subtotal,
    tax_amount: rec1Input.tax_amount,
    total: rec1Input.total,
    computed_subtotal: val1.computed_subtotal,
    computed_total: val1.computed_total,
    extraction_uncertain: false,
    uncertainty_notes: null,
    validation_status: val1.validation_status,
    status: val1.validation_status,
    validation_results: val1.checks,
    review_decisions: [],
    audit_events: [
      { id: 'ae-1', actor: 'System', event_type: 'UPLOADED', details: 'Uploaded meridian_mos_4412.svg', created_at: iso(95) },
      { id: 'ae-2', actor: 'Gemini Extractor', event_type: 'EXTRACTED', details: 'Extracted 2 line items and header fields', created_at: iso(94) },
      { id: 'ae-3', actor: 'Deterministic Validator', event_type: 'VALIDATED', details: 'Flagged TOTAL_MISMATCH (+60.00); routed to NEEDS_REVIEW', created_at: iso(94) },
    ],
    duplicate_of_id: null,
    created_at: iso(95),
    updated_at: iso(94),
  };

  // Record 2: Valid (Eligible for Approval, not yet approved by human)
  const rec2Id = 'inv-demo-1002';
  const rec2Input = {
    id: rec2Id,
    vendor_name: 'Kestrel Cloud Services',
    invoice_number: 'KCS-8891',
    invoice_date: '2026-11-20',
    currency: 'USD',
    line_items: [
      { id: 'l1', description: 'Managed Postgres Cluster (Nov)', quantity: '1', unit_price: '640.00', amount: '640.00' },
      { id: 'l2', description: 'Object Storage & Backups', quantity: '4', unit_price: '45.00', amount: '180.00' },
    ],
    subtotal: '820.00',
    tax_amount: '73.80',
    total: '893.80',
  };
  const val2 = validateInvoiceData(rec2Input, [rec1], policy);
  fs.writeFileSync(
    path.resolve(FILES_DIR, `${rec2Id}.svg`),
    createSyntheticSvgInvoice({
      vendor: 'Kestrel Cloud Services',
      address: '88 Market St, San Francisco, CA',
      invoiceNumber: 'KCS-8891',
      date: '2026-11-20',
      currency: 'USD',
      lines: [
        { desc: 'Managed Postgres Cluster (Nov)', qty: '1', unit: '640.00', amt: '640.00' },
        { desc: 'Object Storage & Backups', qty: '4', unit: '45.00', amt: '180.00' },
      ],
      subtotal: '820.00',
      tax: '73.80',
      total: '893.80',
      note: 'Synthetic test case: arithmetic passes; awaiting human approval.',
    })
  );

  const rec2: InvoiceRecord = {
    id: rec2Id,
    filename: 'kestrel_kcs_8891.svg',
    mime_type: 'image/svg+xml',
    has_file: true,
    vendor_name: rec2Input.vendor_name,
    invoice_number: rec2Input.invoice_number,
    invoice_date: rec2Input.invoice_date,
    currency: rec2Input.currency,
    line_items: val2.normalized_line_items,
    subtotal: rec2Input.subtotal,
    tax_amount: rec2Input.tax_amount,
    total: rec2Input.total,
    computed_subtotal: val2.computed_subtotal,
    computed_total: val2.computed_total,
    extraction_uncertain: false,
    uncertainty_notes: null,
    validation_status: val2.validation_status,
    status: val2.validation_status,
    validation_results: val2.checks,
    review_decisions: [],
    audit_events: [
      { id: 'ae-4', actor: 'System', event_type: 'UPLOADED', details: 'Uploaded kestrel_kcs_8891.svg', created_at: iso(55) },
      { id: 'ae-5', actor: 'Gemini Extractor', event_type: 'EXTRACTED', details: 'Extracted 2 line items and header fields', created_at: iso(54) },
      { id: 'ae-6', actor: 'Deterministic Validator', event_type: 'VALIDATED', details: 'All deterministic checks passed; marked VALID (eligible for approval)', created_at: iso(54) },
    ],
    duplicate_of_id: null,
    created_at: iso(55),
    updated_at: iso(54),
  };

  // Record 3: Approved by human reviewer
  const rec3Id = 'inv-demo-1003';
  const rec3Input = {
    id: rec3Id,
    vendor_name: 'Northwind Logistics Ltd',
    invoice_number: 'NWL-2026-100',
    invoice_date: '2026-11-15',
    currency: 'USD',
    line_items: [
      { id: 'l1', description: 'Regional Freight Batch #14', quantity: '5', unit_price: '320.00', amount: '1600.00' },
    ],
    subtotal: '1600.00',
    tax_amount: '160.00',
    total: '1760.00',
  };
  const val3 = validateInvoiceData(rec3Input, [rec1, rec2], policy);
  fs.writeFileSync(
    path.resolve(FILES_DIR, `${rec3Id}.svg`),
    createSyntheticSvgInvoice({
      vendor: 'Northwind Logistics Ltd',
      address: '1200 Dockside Ave, Portland, OR',
      invoiceNumber: 'NWL-2026-100',
      date: '2026-11-15',
      currency: 'USD',
      lines: [
        { desc: 'Regional Freight Batch #14', qty: '5', unit: '320.00', amt: '1600.00' },
      ],
      subtotal: '1600.00',
      tax: '160.00',
      total: '1760.00',
      note: 'Synthetic test case: verified and explicitly approved by reviewer.',
    })
  );

  const rec3: InvoiceRecord = {
    id: rec3Id,
    filename: 'northwind_nwl_100.svg',
    mime_type: 'image/svg+xml',
    has_file: true,
    vendor_name: rec3Input.vendor_name,
    invoice_number: rec3Input.invoice_number,
    invoice_date: rec3Input.invoice_date,
    currency: rec3Input.currency,
    line_items: val3.normalized_line_items,
    subtotal: rec3Input.subtotal,
    tax_amount: rec3Input.tax_amount,
    total: rec3Input.total,
    computed_subtotal: val3.computed_subtotal,
    computed_total: val3.computed_total,
    extraction_uncertain: false,
    uncertainty_notes: null,
    validation_status: val3.validation_status,
    status: 'APPROVED',
    validation_results: val3.checks,
    review_decisions: [
      {
        id: 'dec-1',
        reviewer_name: 'Elena Vance (Finance Lead)',
        decision: 'APPROVED',
        comment: 'Confirmed freight manifest receipt and verified arithmetic.',
        created_at: iso(180),
      },
    ],
    audit_events: [
      { id: 'ae-7', actor: 'System', event_type: 'UPLOADED', details: 'Uploaded northwind_nwl_100.svg', created_at: iso(210) },
      { id: 'ae-8', actor: 'Gemini Extractor', event_type: 'EXTRACTED', details: 'Extracted 1 line item and header fields', created_at: iso(209) },
      { id: 'ae-9', actor: 'Deterministic Validator', event_type: 'VALIDATED', details: 'All deterministic checks passed; marked VALID', created_at: iso(209) },
      { id: 'ae-10', actor: 'Elena Vance (Finance Lead)', event_type: 'DECISION_RECORDED', details: 'Recorded decision: APPROVED', created_at: iso(180) },
    ],
    duplicate_of_id: null,
    created_at: iso(210),
    updated_at: iso(180),
  };

  return {
    policy,
    invoices: [rec1, rec2, rec3],
  };
}

let cachedState: DatabaseState | null = null;

export function loadDb(): DatabaseState {
  if (cachedState) return cachedState;
  ensureDirs();
  if (!fs.existsSync(DB_FILE)) {
    const seed = buildDemoSeed();
    saveDb(seed);
    return seed;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as DatabaseState;
    cachedState = {
      policy: parsed.policy ?? { ...DEFAULT_POLICY },
      invoices: Array.isArray(parsed.invoices) ? parsed.invoices : [],
    };
    return cachedState;
  } catch {
    const seed = buildDemoSeed();
    saveDb(seed);
    return seed;
  }
}

export function saveDb(state: DatabaseState): void {
  ensureDirs();
  cachedState = state;
  const tmpFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2), 'utf-8');
  fs.renameSync(tmpFile, DB_FILE);
}

export function saveUploadedFile(id: string, mimeType: string, buffer: Buffer): void {
  ensureDirs();
  const ext =
    mimeType === 'application/pdf'
      ? 'pdf'
      : mimeType === 'image/png'
      ? 'png'
      : mimeType === 'image/jpeg'
      ? 'jpg'
      : 'bin';
  const safePath = path.resolve(FILES_DIR, `${id}.${ext}`);
  if (!safePath.startsWith(FILES_DIR + path.sep)) {
    throw new Error('Invalid file storage path');
  }
  fs.writeFileSync(safePath, buffer);
}

export function resolveStoredFile(
  id: string,
  mimeType: string
): { filePath: string; mimeType: string } | null {
  ensureDirs();
  const extMap: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/svg+xml': 'svg',
  };
  const ext = extMap[mimeType];
  if (!ext) return null;
  const safePath = path.resolve(FILES_DIR, `${id}.${ext}`);
  if (!safePath.startsWith(FILES_DIR + path.sep)) {
    return null;
  }
  if (!fs.existsSync(safePath)) return null;
  return { filePath: safePath, mimeType };
}

export function deleteStoredFile(id: string): void {
  ensureDirs();
  for (const ext of ['pdf', 'png', 'jpg', 'svg', 'bin']) {
    const safePath = path.resolve(FILES_DIR, `${id}.${ext}`);
    if (safePath.startsWith(FILES_DIR + path.sep) && fs.existsSync(safePath)) {
      fs.unlinkSync(safePath);
    }
  }
}
