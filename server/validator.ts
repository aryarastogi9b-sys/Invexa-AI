import Decimal from 'decimal.js';
import type {
  InvoiceRecord,
  LineItem,
  PolicyConfig,
  ValidationCheck,
  ValidationStatus,
  ValidatorTestResult,
} from '../src/types/invoice.ts';

Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

export interface CandidateInvoiceInput {
  id?: string;
  vendor_name: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  currency: string | null;
  line_items: Array<{
    id?: string;
    description: string;
    quantity: string | number | null;
    unit_price: string | number | null;
    discount?: string | number | null;
    amount: string | number | null;
  }>;
  subtotal: string | number | null;
  tax_amount: string | number | null;
  total: string | number | null;
  extraction_uncertain?: boolean;
  uncertainty_notes?: string | null;
}

export interface ValidationOutcome {
  validation_status: ValidationStatus;
  computed_subtotal: string | null;
  computed_total: string | null;
  checks: ValidationCheck[];
  normalized_line_items: LineItem[];
  duplicate_of_id: string | null;
}

function toDecimal(val: string | number | null | undefined): Decimal | null {
  if (val === null || val === undefined) return null;
  const cleaned = String(val).replace(/[,\s$€£¥₹]/g, '').trim();
  if (!cleaned) return null;
  try {
    const d = new Decimal(cleaned);
    return d.isFinite() ? d : null;
  } catch {
    return null;
  }
}

function fmt2(d: Decimal | null): string | null {
  return d ? d.toFixed(2) : null;
}

function normalizeKey(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function validateInvoiceData(
  input: CandidateInvoiceInput,
  existingRecords: InvoiceRecord[],
  policy: PolicyConfig
): ValidationOutcome {
  const checks: ValidationCheck[] = [];
  const tolerance = toDecimal(policy.arithmetic_tolerance) ?? new Decimal('0.01');
  const threshold = toDecimal(policy.approval_threshold) ?? new Decimal('5000.00');

  let hasBlockingIssue = false;

  // 1. Extraction uncertainty check
  if (input.extraction_uncertain) {
    hasBlockingIssue = true;
    checks.push({
      rule_code: 'EXTRACTION_UNCERTAINTY',
      label: 'Document Readability',
      status: 'FAIL',
      severity: 'ERROR',
      expected_value: 'Clear machine-readable fields',
      observed_value: input.uncertainty_notes || 'Ambiguous or unreadable scan',
      message:
        input.uncertainty_notes ||
        'Document contains blurry, ambiguous, or incomplete text requiring human verification.',
      review_guidance: 'Inspect the source document and confirm or correct highlighted fields.',
    });
  } else {
    checks.push({
      rule_code: 'EXTRACTION_UNCERTAINTY',
      label: 'Document Readability',
      status: 'PASS',
      severity: 'INFO',
      expected_value: 'Clear document',
      observed_value: 'Readable',
      message: 'All visible document fields were extracted without readability warnings.',
      review_guidance: 'No action needed.',
    });
  }

  // 2. Vendor name
  const vendorClean = (input.vendor_name ?? '').trim();
  if (!vendorClean) {
    hasBlockingIssue = true;
    checks.push({
      rule_code: 'MISSING_VENDOR',
      label: 'Vendor Identification',
      status: 'FAIL',
      severity: 'ERROR',
      expected_value: 'Non-empty vendor name',
      observed_value: 'Missing',
      message: 'Vendor name is missing from the extracted document.',
      review_guidance: 'Enter the vendor legal name from the source invoice.',
    });
  } else {
    checks.push({
      rule_code: 'MISSING_VENDOR',
      label: 'Vendor Identification',
      status: 'PASS',
      severity: 'INFO',
      expected_value: 'Non-empty vendor name',
      observed_value: vendorClean,
      message: `Vendor identified as ${vendorClean}.`,
      review_guidance: 'No action needed.',
    });
  }

  // 3. Invoice number
  const invoiceNumClean = (input.invoice_number ?? '').trim();
  if (policy.require_invoice_number && !invoiceNumClean) {
    hasBlockingIssue = true;
    checks.push({
      rule_code: 'MISSING_INVOICE_NUMBER',
      label: 'Invoice Number',
      status: 'FAIL',
      severity: 'ERROR',
      expected_value: 'Non-empty invoice identifier',
      observed_value: 'Missing',
      message: 'Invoice number is missing.',
      review_guidance: 'Verify the source document for an invoice or reference number.',
    });
  } else {
    checks.push({
      rule_code: 'MISSING_INVOICE_NUMBER',
      label: 'Invoice Number',
      status: 'PASS',
      severity: 'INFO',
      expected_value: 'Present',
      observed_value: invoiceNumClean || 'Optional',
      message: invoiceNumClean
        ? `Invoice number ${invoiceNumClean} is present.`
        : 'Invoice number check waived by policy.',
      review_guidance: 'No action needed.',
    });
  }

  // 4. Date & Currency format
  const dateClean = (input.invoice_date ?? '').trim();
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(dateClean) && !Number.isNaN(Date.parse(dateClean));
  if (!dateClean || !validDate) {
    hasBlockingIssue = true;
    checks.push({
      rule_code: 'DATE_FORMAT',
      label: 'Invoice Date',
      status: 'FAIL',
      severity: 'WARNING',
      expected_value: 'YYYY-MM-DD',
      observed_value: dateClean || 'Missing',
      message: dateClean
        ? `Invoice date "${dateClean}" is not in standard YYYY-MM-DD format.`
        : 'Invoice date is missing.',
      review_guidance: 'Confirm and standardize the invoice issue date.',
    });
  } else {
    checks.push({
      rule_code: 'DATE_FORMAT',
      label: 'Invoice Date',
      status: 'PASS',
      severity: 'INFO',
      expected_value: 'YYYY-MM-DD',
      observed_value: dateClean,
      message: `Invoice date ${dateClean} is valid.`,
      review_guidance: 'No action needed.',
    });
  }

  const currencyClean = (input.currency ?? '').trim().toUpperCase();
  const validCurrency = /^[A-Z]{3}$/.test(currencyClean);
  if (!validCurrency) {
    hasBlockingIssue = true;
    checks.push({
      rule_code: 'CURRENCY_CODE',
      label: 'Currency Code',
      status: 'FAIL',
      severity: 'ERROR',
      expected_value: 'ISO 4217 3-letter code (e.g. USD, EUR)',
      observed_value: currencyClean || 'Missing',
      message: currencyClean
        ? `Currency "${currencyClean}" is not a valid 3-letter ISO code.`
        : 'Currency code is missing.',
      review_guidance: 'Confirm the invoice currency before approval.',
    });
  } else {
    checks.push({
      rule_code: 'CURRENCY_CODE',
      label: 'Currency Code',
      status: 'PASS',
      severity: 'INFO',
      expected_value: '3-letter ISO code',
      observed_value: currencyClean,
      message: `Currency is ${currencyClean}.`,
      review_guidance: 'No action needed.',
    });
  }

  // 5. Line items recomputation
  let lineSum = new Decimal('0');
  let lineArithmeticFailed = false;
  let lineCountWithAmounts = 0;

  const normalized_line_items: LineItem[] = (input.line_items ?? []).map((item, idx) => {
    const qty = toDecimal(item.quantity);
    const unitPrice = toDecimal(item.unit_price);
    const discount = toDecimal(item.discount) ?? new Decimal('0');
    const observedAmount = toDecimal(item.amount);

    let computedAmount: Decimal | null = null;
    if (qty !== null && unitPrice !== null) {
      computedAmount = qty.times(unitPrice).minus(discount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }

    let matches: boolean | null = null;
    if (computedAmount !== null && observedAmount !== null) {
      matches = computedAmount.minus(observedAmount).abs().lte(tolerance);
      if (!matches) {
        lineArithmeticFailed = true;
      }
    }

    if (computedAmount !== null) {
      lineSum = lineSum.plus(computedAmount);
      lineCountWithAmounts += 1;
    } else if (observedAmount !== null) {
      lineSum = lineSum.plus(observedAmount);
      lineCountWithAmounts += 1;
    }

    return {
      id: item.id || `line-${idx + 1}`,
      description: item.description || `Line item ${idx + 1}`,
      quantity: qty !== null ? qty.toString() : null,
      unit_price: fmt2(unitPrice),
      discount: discount.gt(0) ? fmt2(discount) : null,
      amount: fmt2(observedAmount),
      computed_amount: fmt2(computedAmount),
      matches,
    };
  });

  if (lineArithmeticFailed) {
    hasBlockingIssue = true;
    const mismatched = normalized_line_items.filter((l) => l.matches === false);
    checks.push({
      rule_code: 'LINE_ITEM_MISMATCH',
      label: 'Line Item Arithmetic',
      status: 'FAIL',
      severity: 'ERROR',
      expected_value: 'Quantity x Unit Price = Line Amount',
      observed_value: `${mismatched.length} line(s) do not reconcile`,
      message: `${mismatched.length} line item(s) have amounts that differ from quantity × unit price.`,
      review_guidance: 'Compare unit prices, quantities, and discounts against the source PDF/image.',
    });
  } else if (normalized_line_items.length > 0) {
    checks.push({
      rule_code: 'LINE_ITEM_MISMATCH',
      label: 'Line Item Arithmetic',
      status: 'PASS',
      severity: 'INFO',
      expected_value: 'All lines reconcile',
      observed_value: `${normalized_line_items.length} line(s) verified`,
      message: `All ${normalized_line_items.length} extracted line items reconcile cleanly.`,
      review_guidance: 'No action needed.',
    });
  }

  // 6. Subtotal vs sum of lines
  const subtotalDec = toDecimal(input.subtotal);
  const taxDec = toDecimal(input.tax_amount) ?? new Decimal('0');
  const totalDec = toDecimal(input.total);

  const computedSubtotal =
    lineCountWithAmounts > 0 ? lineSum.toDecimalPlaces(2, Decimal.ROUND_HALF_UP) : subtotalDec;

  if (subtotalDec !== null && lineCountWithAmounts > 0) {
    const subDiff = subtotalDec.minus(lineSum).abs();
    if (subDiff.gt(tolerance)) {
      hasBlockingIssue = true;
      checks.push({
        rule_code: 'SUBTOTAL_MISMATCH',
        label: 'Subtotal Reconciliation',
        status: 'FAIL',
        severity: 'ERROR',
        expected_value: lineSum.toFixed(2),
        observed_value: subtotalDec.toFixed(2),
        message: `Sum of line items is ${lineSum.toFixed(2)}, but document subtotal shows ${subtotalDec.toFixed(2)}.`,
        review_guidance: 'Check for omitted line items, hidden fees, or invoice-level discounts.',
      });
    } else {
      checks.push({
        rule_code: 'SUBTOTAL_RECONCILIATION',
        label: 'Subtotal Reconciliation',
        status: 'PASS',
        severity: 'INFO',
        expected_value: lineSum.toFixed(2),
        observed_value: subtotalDec.toFixed(2),
        message: `Line items sum to ${lineSum.toFixed(2)}, matching document subtotal.`,
        review_guidance: 'No action needed.',
      });
    }
  } else if (subtotalDec === null) {
    hasBlockingIssue = true;
    checks.push({
      rule_code: 'MISSING_SUBTOTAL',
      label: 'Subtotal Presence',
      status: 'FAIL',
      severity: 'ERROR',
      expected_value: 'Numeric subtotal',
      observed_value: 'Missing',
      message: 'Document subtotal could not be read.',
      review_guidance: 'Verify the subtotal amount from the source invoice.',
    });
  }

  // 7. Total = Subtotal + Tax (strictly deterministic Decimal check)
  const effectiveSubtotal = subtotalDec ?? computedSubtotal;
  const computedTotal =
    effectiveSubtotal !== null
      ? effectiveSubtotal.plus(taxDec).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      : null;

  if (effectiveSubtotal === null || totalDec === null || computedTotal === null) {
    hasBlockingIssue = true;
    checks.push({
      rule_code: 'MISSING_TOTAL',
      label: 'Grand Total Verification',
      status: 'FAIL',
      severity: 'ERROR',
      expected_value: fmt2(computedTotal) ?? 'Numeric total',
      observed_value: fmt2(totalDec) ?? 'Missing',
      message: 'Grand total is missing or could not be parsed for deterministic verification.',
      review_guidance: 'Enter the exact invoice total from the source document.',
    });
  } else {
    const diff = totalDec.minus(computedTotal);
    if (diff.abs().gt(tolerance)) {
      hasBlockingIssue = true;
      const sign = diff.isPositive() ? '+' : '';
      checks.push({
        rule_code: 'TOTAL_MISMATCH',
        label: 'Grand Total Verification',
        status: 'FAIL',
        severity: 'ERROR',
        expected_value: computedTotal.toFixed(2),
        observed_value: totalDec.toFixed(2),
        message: `Expected ${computedTotal.toFixed(2)} (subtotal ${effectiveSubtotal.toFixed(2)} + tax ${taxDec.toFixed(2)}); document shows ${totalDec.toFixed(2)} (${sign}${diff.toFixed(2)}).`,
        review_guidance: 'Reject or request a corrected invoice from the vendor before payment.',
      });
    } else {
      checks.push({
        rule_code: 'TOTAL_VERIFICATION',
        label: 'Grand Total Verification',
        status: 'PASS',
        severity: 'INFO',
        expected_value: computedTotal.toFixed(2),
        observed_value: totalDec.toFixed(2),
        message: `Subtotal (${effectiveSubtotal.toFixed(2)}) + Tax (${taxDec.toFixed(2)}) equals ${totalDec.toFixed(2)}.`,
        review_guidance: 'Arithmetic verified.',
      });
    }
  }

  // 8. Duplicate detection
  let duplicateOfId: string | null = null;
  if (policy.duplicate_check_enabled && vendorClean && invoiceNumClean) {
    const targetVendor = normalizeKey(vendorClean);
    const targetNum = normalizeKey(invoiceNumClean);
    const match = existingRecords.find(
      (rec) =>
        rec.id !== input.id &&
        normalizeKey(rec.vendor_name) === targetVendor &&
        normalizeKey(rec.invoice_number) === targetNum
    );
    if (match) {
      duplicateOfId = match.id;
      hasBlockingIssue = true;
      checks.push({
        rule_code: 'POSSIBLE_DUPLICATE',
        label: 'Duplicate Detection',
        status: 'WARNING',
        severity: 'WARNING',
        expected_value: 'Unique vendor + invoice number',
        observed_value: `Matches record ${match.id}`,
        message: `Possible duplicate: ${vendorClean} invoice ${invoiceNumClean} already exists (${match.status}).`,
        review_guidance: 'Compare against the existing record to verify whether this is a duplicate or an amended invoice.',
      });
    } else {
      checks.push({
        rule_code: 'DUPLICATE_CHECK',
        label: 'Duplicate Detection',
        status: 'PASS',
        severity: 'INFO',
        expected_value: 'Unique vendor + invoice number',
        observed_value: 'No match found',
        message: 'No existing invoice shares this normalized vendor and invoice number.',
        review_guidance: 'No action needed.',
      });
    }
  }

  // 9. Approval threshold routing
  if (totalDec !== null && totalDec.gt(threshold)) {
    hasBlockingIssue = true;
    checks.push({
      rule_code: 'APPROVAL_THRESHOLD_EXCEEDED',
      label: 'Approval Policy Threshold',
      status: 'WARNING',
      severity: 'WARNING',
      expected_value: `<= ${threshold.toFixed(2)}`,
      observed_value: totalDec.toFixed(2),
      message: `Invoice total (${totalDec.toFixed(2)}) exceeds the ${threshold.toFixed(2)} policy threshold and requires authorized approver sign-off.`,
      review_guidance: 'Route to an authorized senior approver for explicit sign-off.',
    });
  } else if (totalDec !== null) {
    checks.push({
      rule_code: 'APPROVAL_THRESHOLD',
      label: 'Approval Policy Threshold',
      status: 'PASS',
      severity: 'INFO',
      expected_value: `<= ${threshold.toFixed(2)}`,
      observed_value: totalDec.toFixed(2),
      message: `Total (${totalDec.toFixed(2)}) is within the ${threshold.toFixed(2)} standard approval limit.`,
      review_guidance: 'No escalation required.',
    });
  }

  return {
    validation_status: hasBlockingIssue ? 'NEEDS_REVIEW' : 'VALID',
    computed_subtotal: fmt2(computedSubtotal),
    computed_total: fmt2(computedTotal),
    checks,
    normalized_line_items,
    duplicate_of_id: duplicateOfId,
  };
}

export function runDeterministicTestSuite(policy: PolicyConfig): ValidatorTestResult[] {
  const existingRecord: InvoiceRecord = {
    id: 'test-existing-1',
    filename: 'existing.png',
    mime_type: 'image/png',
    has_file: false,
    vendor_name: 'Northwind Logistics',
    invoice_number: 'INV-2026-100',
    invoice_date: '2026-10-12',
    currency: 'USD',
    line_items: [],
    subtotal: '1000.00',
    tax_amount: '180.00',
    total: '1180.00',
    computed_subtotal: '1000.00',
    computed_total: '1180.00',
    extraction_uncertain: false,
    uncertainty_notes: null,
    validation_status: 'VALID',
    status: 'APPROVED',
    validation_results: [],
    review_decisions: [],
    audit_events: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const cases: Array<{
    name: string;
    scenario: string;
    expected_status: ValidationStatus;
    expected_rule_code?: string;
    input: CandidateInvoiceInput;
  }> = [
    {
      name: 'Valid Invoice Arithmetic',
      scenario: 'Correct line items, subtotal (1000.00), tax (180.00), and total (1180.00).',
      expected_status: 'VALID',
      input: {
        vendor_name: 'Apex Cloud Corp',
        invoice_number: 'AC-9001',
        invoice_date: '2026-11-01',
        currency: 'USD',
        line_items: [
          { description: 'Compute Cluster', quantity: 2, unit_price: '400.00', amount: '800.00' },
          { description: 'Object Storage', quantity: 4, unit_price: '50.00', amount: '200.00' },
        ],
        subtotal: '1000.00',
        tax_amount: '180.00',
        total: '1180.00',
      },
    },
    {
      name: 'Deliberate Total Mismatch (+60.00)',
      scenario: 'Subtotal (1000.00) + Tax (180.00) = 1180.00, but document shows 1240.00.',
      expected_status: 'NEEDS_REVIEW',
      expected_rule_code: 'TOTAL_MISMATCH',
      input: {
        vendor_name: 'Meridian Supplies',
        invoice_number: 'MS-4412',
        invoice_date: '2026-11-02',
        currency: 'USD',
        line_items: [
          { description: 'Workstation Monitors', quantity: 4, unit_price: '250.00', amount: '1000.00' },
        ],
        subtotal: '1000.00',
        tax_amount: '180.00',
        total: '1240.00',
      },
    },
    {
      name: 'Missing Invoice Number',
      scenario: 'Invoice number is null/empty while all numbers reconcile.',
      expected_status: 'NEEDS_REVIEW',
      expected_rule_code: 'MISSING_INVOICE_NUMBER',
      input: {
        vendor_name: 'Harbor Freight Partners',
        invoice_number: null,
        invoice_date: '2026-11-03',
        currency: 'USD',
        line_items: [
          { description: 'Pallet Delivery', quantity: 1, unit_price: '450.00', amount: '450.00' },
        ],
        subtotal: '450.00',
        tax_amount: '45.00',
        total: '495.00',
      },
    },
    {
      name: 'Duplicate Vendor & Invoice Number',
      scenario: 'Northwind Logistics + INV-2026-100 uploaded a second time.',
      expected_status: 'NEEDS_REVIEW',
      expected_rule_code: 'POSSIBLE_DUPLICATE',
      input: {
        vendor_name: 'Northwind Logistics',
        invoice_number: 'INV-2026-100',
        invoice_date: '2026-11-04',
        currency: 'USD',
        line_items: [
          { description: 'Freight Forwarding', quantity: 1, unit_price: '1000.00', amount: '1000.00' },
        ],
        subtotal: '1000.00',
        tax_amount: '180.00',
        total: '1180.00',
      },
    },
    {
      name: 'Blurry / Uncertain Scan',
      scenario: 'AI flags extraction_uncertain = true due to low scan contrast.',
      expected_status: 'NEEDS_REVIEW',
      expected_rule_code: 'EXTRACTION_UNCERTAINTY',
      input: {
        vendor_name: 'Cobalt Print Studio',
        invoice_number: 'CP-772',
        invoice_date: '2026-11-05',
        currency: 'USD',
        line_items: [
          { description: 'Brochure Print Run', quantity: 10, unit_price: '35.00', amount: '350.00' },
        ],
        subtotal: '350.00',
        tax_amount: '35.00',
        total: '385.00',
        extraction_uncertain: true,
        uncertainty_notes: 'Tax digit partially obscured by fold mark.',
      },
    },
    {
      name: 'Exceeds Approval Threshold',
      scenario: 'Clean arithmetic totaling 12,400.00 above configured approval threshold.',
      expected_status: 'NEEDS_REVIEW',
      expected_rule_code: 'APPROVAL_THRESHOLD_EXCEEDED',
      input: {
        vendor_name: 'Vanguard Enterprise Systems',
        invoice_number: 'VES-2026-88',
        invoice_date: '2026-11-06',
        currency: 'USD',
        line_items: [
          { description: 'Annual Platform License', quantity: 1, unit_price: '11000.00', amount: '11000.00' },
        ],
        subtotal: '11000.00',
        tax_amount: '1400.00',
        total: '12400.00',
      },
    },
  ];

  return cases.map((tc) => {
    const result = validateInvoiceData(tc.input, [existingRecord], policy);
    const hasExpectedRule = tc.expected_rule_code
      ? result.checks.some(
          (c) => c.rule_code === tc.expected_rule_code && c.status !== 'PASS'
        )
      : true;
    const passed = result.validation_status === tc.expected_status && hasExpectedRule;
    const failedRule = result.checks.find((c) => c.status !== 'PASS');
    return {
      name: tc.name,
      scenario: tc.scenario,
      expected_status: tc.expected_status,
      expected_rule_code: tc.expected_rule_code,
      actual_status: result.validation_status,
      passed,
      details: failedRule ? failedRule.message : 'All deterministic checks passed.',
    };
  });
}
