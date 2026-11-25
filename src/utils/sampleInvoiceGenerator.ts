export interface SampleTemplate {
  id: string;
  title: string;
  subtitle: string;
  expectedOutcome: string;
  filename: string;
  vendor: string;
  address: string;
  invoiceNumber: string | null;
  date: string;
  currency: string;
  lines: Array<{ desc: string; qty: string; unit: string; amt: string }>;
  subtotal: string;
  tax: string;
  total: string;
  blurry?: boolean;
}

export const SAMPLE_TEMPLATES: SampleTemplate[] = [
  {
    id: 'sample-valid',
    title: '01. Clean Standard Invoice',
    subtitle: 'All line items, subtotal, tax, and total reconcile cleanly.',
    expectedOutcome: 'Status: VALID (Eligible for approval)',
    filename: 'sample_01_northstar_valid.png',
    vendor: 'Northstar Design Studio',
    address: '210 Pine Street, Seattle, WA 98101',
    invoiceNumber: 'NDS-2026-301',
    date: '2026-11-21',
    currency: 'USD',
    lines: [
      { desc: 'UX Architecture Workshop', qty: '2', unit: '450.00', amt: '900.00' },
      { desc: 'Design System Documentation', qty: '3', unit: '100.00', amt: '300.00' },
    ],
    subtotal: '1200.00',
    tax: '120.00',
    total: '1320.00',
  },
  {
    id: 'sample-mismatch',
    title: '02. Deliberate Total Mismatch (+60.00)',
    subtitle: 'Subtotal (1000.00) + Tax (180.00) = 1180.00, but invoice prints 1240.00.',
    expectedOutcome: 'Rule: TOTAL_MISMATCH · Status: NEEDS_REVIEW',
    filename: 'sample_02_meridian_mismatch.png',
    vendor: 'Meridian Hardware Co',
    address: '742 Evergreen Terrace, Portland, OR',
    invoiceNumber: 'MHC-2026-778',
    date: '2026-11-22',
    currency: 'USD',
    lines: [
      { desc: 'Workstation Monitors 27"', qty: '4', unit: '250.00', amt: '1000.00' },
    ],
    subtotal: '1000.00',
    tax: '180.00',
    total: '1240.00',
  },
  {
    id: 'sample-missing-num',
    title: '03. Missing Invoice Number',
    subtitle: 'Arithmetic is accurate, but invoice identifier is absent.',
    expectedOutcome: 'Rule: MISSING_INVOICE_NUMBER · Status: NEEDS_REVIEW',
    filename: 'sample_03_harbor_missing_id.png',
    vendor: 'Harbor Freight Partners',
    address: '95 Pier Way, Tacoma, WA',
    invoiceNumber: null,
    date: '2026-11-22',
    currency: 'USD',
    lines: [
      { desc: 'Cold Chain Pallet Delivery', qty: '3', unit: '150.00', amt: '450.00' },
    ],
    subtotal: '450.00',
    tax: '45.00',
    total: '495.00',
  },
  {
    id: 'sample-duplicate',
    title: '04. Possible Duplicate Invoice',
    subtitle: 'Matches existing Northwind Logistics Ltd invoice NWL-2026-100.',
    expectedOutcome: 'Rule: POSSIBLE_DUPLICATE · Status: NEEDS_REVIEW',
    filename: 'sample_04_northwind_duplicate.png',
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
  },
  {
    id: 'sample-threshold',
    title: '05. High-Value Above Policy Limit',
    subtitle: 'Clean arithmetic totaling 12,400.00 (exceeds $5,000.00 limit).',
    expectedOutcome: 'Rule: APPROVAL_THRESHOLD_EXCEEDED · Status: NEEDS_REVIEW',
    filename: 'sample_05_vanguard_high_value.png',
    vendor: 'Vanguard Enterprise Systems',
    address: '500 Capitol Mall, Sacramento, CA',
    invoiceNumber: 'VES-2026-088',
    date: '2026-11-23',
    currency: 'USD',
    lines: [
      { desc: 'Annual Enterprise Seat License', qty: '1', unit: '11000.00', amt: '11000.00' },
    ],
    subtotal: '11000.00',
    tax: '1400.00',
    total: '12400.00',
  },
  {
    id: 'sample-blurry',
    title: '06. Low-Contrast / Obscured Scan',
    subtitle: 'Degraded scan contrast and partially obscured tax figure.',
    expectedOutcome: 'Rule: EXTRACTION_UNCERTAINTY · Status: NEEDS_REVIEW',
    filename: 'sample_06_cobalt_uncertain.png',
    vendor: 'Cobalt Print Studio',
    address: '14 Mercer Ave, Bellevue, WA',
    invoiceNumber: 'CPS-992',
    date: '2026-11-20',
    currency: 'USD',
    lines: [
      { desc: 'Quarterly Report Printing', qty: '10', unit: '35.00', amt: '350.00' },
    ],
    subtotal: '350.00',
    tax: '35.00',
    total: '385.00',
    blurry: true,
  },
];

export async function generateSampleInvoiceFile(template: SampleTemplate): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 760;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas rendering unavailable in this browser.');
  }

  // White paper background
  ctx.fillStyle = template.blurry ? '#e2e8f0' : '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (template.blurry) {
    ctx.filter = 'blur(1.8px)';
  }

  // Top dark accent bar
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, 12);

  // Header
  ctx.fillStyle = template.blurry ? '#64748b' : '#0f172a';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText(template.vendor, 60, 78);

  ctx.fillStyle = '#64748b';
  ctx.font = '16px sans-serif';
  ctx.fillText(template.address, 60, 108);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#334155';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('INVOICE', 840, 78);

  ctx.font = '16px monospace';
  ctx.fillStyle = '#475569';
  ctx.fillText(
    template.invoiceNumber ? `Invoice #: ${template.invoiceNumber}` : 'Invoice #: ',
    840,
    112
  );
  ctx.fillText(`Date: ${template.date}`, 840, 138);
  ctx.fillText(`Currency: ${template.currency}`, 840, 164);

  ctx.textAlign = 'left';
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(60, 195);
  ctx.lineTo(840, 195);
  ctx.stroke();

  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('BILL TO', 60, 232);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('Invexa Accounts Payable Department', 60, 258);

  // Table header
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(60, 296, 780, 42);
  ctx.fillStyle = '#334155';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('DESCRIPTION', 76, 322);
  ctx.textAlign = 'right';
  ctx.fillText('QTY', 540, 322);
  ctx.fillText('UNIT PRICE', 690, 322);
  ctx.fillText('AMOUNT', 824, 322);

  // Rows
  template.lines.forEach((line, idx) => {
    const y = 374 + idx * 48;
    ctx.textAlign = 'left';
    ctx.fillStyle = template.blurry ? '#64748b' : '#0f172a';
    ctx.font = '17px sans-serif';
    ctx.fillText(line.desc, 76, y);

    ctx.textAlign = 'right';
    ctx.font = '17px monospace';
    ctx.fillText(line.qty, 540, y);
    ctx.fillText(line.unit, 690, y);
    ctx.fillText(line.amt, 824, y);

    ctx.strokeStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(60, y + 18);
    ctx.lineTo(840, y + 18);
    ctx.stroke();
  });

  // Totals
  const totY = 420 + template.lines.length * 48;
  ctx.textAlign = 'right';
  ctx.fillStyle = '#475569';
  ctx.font = '17px sans-serif';
  ctx.fillText('Subtotal', 680, totY);
  ctx.fillStyle = '#0f172a';
  ctx.font = '17px monospace';
  ctx.fillText(`${template.currency} ${template.subtotal}`, 824, totY);

  ctx.fillStyle = '#475569';
  ctx.font = '17px sans-serif';
  ctx.fillText('Tax', 680, totY + 34);
  ctx.fillStyle = '#0f172a';
  ctx.font = '17px monospace';
  ctx.fillText(`${template.currency} ${template.tax}`, 824, totY + 34);

  if (template.blurry) {
    // Draw smudge across tax and total to simulate unreadable scan
    ctx.fillStyle = 'rgba(100, 116, 139, 0.72)';
    ctx.fillRect(720, totY + 14, 120, 48);
  }

  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(540, totY + 54);
  ctx.lineTo(840, totY + 54);
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('Total Due', 680, totY + 86);
  ctx.font = 'bold 20px monospace';
  ctx.fillText(`${template.currency} ${template.total}`, 824, totY + 86);

  ctx.filter = 'none';

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to generate sample PNG image.'));
        return;
      }
      resolve(new File([blob], template.filename, { type: 'image/png' }));
    }, 'image/png');
  });
}
