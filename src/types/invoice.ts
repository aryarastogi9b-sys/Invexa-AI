export type InvoiceStatus =
  | 'PROCESSING'
  | 'VALID'
  | 'NEEDS_REVIEW'
  | 'APPROVED'
  | 'REJECTED';

export type ValidationStatus = 'PROCESSING' | 'VALID' | 'NEEDS_REVIEW';

export interface LineItem {
  id: string;
  description: string;
  quantity: string | null;
  unit_price: string | null;
  discount?: string | null;
  amount: string | null;
  computed_amount?: string | null;
  matches?: boolean | null;
}

export interface ValidationCheck {
  rule_code: string;
  label: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  severity: 'INFO' | 'WARNING' | 'ERROR';
  expected_value: string | null;
  observed_value: string | null;
  message: string;
  review_guidance: string;
}

export interface ReviewDecision {
  id: string;
  reviewer_name: string;
  decision: 'APPROVED' | 'REJECTED' | 'CORRECTION_REQUESTED';
  comment: string;
  created_at: string;
}

export interface AuditEvent {
  id: string;
  actor: string;
  event_type:
    | 'UPLOADED'
    | 'EXTRACTED'
    | 'VALIDATED'
    | 'FIELD_CORRECTED'
    | 'DECISION_RECORDED';
  details: string;
  created_at: string;
}

export interface PolicyConfig {
  approval_threshold: string;
  arithmetic_tolerance: string;
  duplicate_check_enabled: boolean;
  require_invoice_number: boolean;
}

export interface InvoiceRecord {
  id: string;
  filename: string;
  mime_type: string;
  has_file: boolean;
  vendor_name: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  currency: string | null;
  line_items: LineItem[];
  subtotal: string | null;
  tax_amount: string | null;
  total: string | null;
  computed_subtotal: string | null;
  computed_total: string | null;
  extraction_uncertain: boolean;
  uncertainty_notes: string | null;
  validation_status: ValidationStatus;
  status: InvoiceStatus;
  validation_results: ValidationCheck[];
  review_decisions: ReviewDecision[];
  audit_events: AuditEvent[];
  duplicate_of_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ValidatorTestResult {
  name: string;
  scenario: string;
  expected_status: ValidationStatus;
  expected_rule_code?: string;
  actual_status: ValidationStatus;
  passed: boolean;
  details: string;
}
