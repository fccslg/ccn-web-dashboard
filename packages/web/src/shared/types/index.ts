/**
 * Shared TypeScript Types for CCN Business Management System
 * All financial amounts in PAISE (integer) - ₹1 = 100 paise
 */

// ============================================
// Branded Types for Financial Safety
// ============================================

export type Paise = number; // Using plain number for compatibility; validation ensures integer paise

export function toPaise(rupees: number): Paise {
  return Math.round(rupees * 100);
}

export function toRupees(paise: Paise): number {
  return paise / 100;
}

// ============================================
// Enums (match database CHECK constraints)
// ============================================

export type PaymentMode = 'cash' | 'gpay' | 'upi' | 'bank' | 'card' | 'other';
export type CollectionLocation = 'home' | 'office' | 'field';
export type CustomerStatus = 'active' | 'inactive' | 'suspended';
export type BillingStatus = 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled';
export type CashbookCategory =
  | 'balance'
  | 'collection'
  | 'advance'
  | 'deposit_return'
  | 'deposit'
  | 'income'
  | 'expense'
  | 'commission'
  | 'salary';
export type EmployeeRole = 'owner' | 'admin' | 'collector' | 'accountant' | 'viewer';
export type SyncStatus = 'pending' | 'synced' | 'conflict' | 'failed';
export type AccountType = 'cable' | 'internet' | 'combo';
export type ServicePlanType = 'cable' | 'internet' | 'combo';

// ============================================
// Core Entity Types (match database schema)
// ============================================

export interface Organization {
  id: string;
  name: string;
  code: string;
  gst_number: string | null;
  address: Address | null;
  settings: OrganizationSettings;
  created_at: string;
  updated_at: string;
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export interface OrganizationSettings {
  timezone: string;
  date_format: string;
  currency: string;
  financial_year_start_month: number; // 1-12
  auto_carry_forward_pbal: boolean;
  default_payment_mode: PaymentMode;
}

export interface Employee {
  id: string;
  organization_id: string;
  user_id: string; // Supabase Auth UUID
  name: string;
  role: EmployeeRole;
  phone: string | null;
  is_active: boolean;
  permissions: EmployeePermissions;
  created_at: string;
  updated_at: string;
}

export interface EmployeePermissions {
  can_manage_employees: boolean;
  can_manage_customers: boolean;
  can_view_all_financials: boolean;
  can_approve_corrections: boolean;
  can_import_export: boolean;
  can_configure_system: boolean;
  assigned_locations: string[]; // empty = all
  assigned_collectors: string[]; // empty = all
}

export interface Customer {
  id: string;
  organization_id: string;
  portal_customer_id: string; // LCOID from portal (alphanumeric, preserve exactly)
  name: string;
  mobile: string | null;
  address: string | null;
  location: string | null; // BC Colony, Janata Nagar, etc.
  cable_ref_id: string | null; // Serial from Cable Ref
  internet_ref_id: string | null; // ID from Internet Ref (FCCxxx, etc.)
  status: CustomerStatus;
  metadata: CustomerMetadata;
  created_at: string;
  updated_at: string;
}

export interface CustomerMetadata {
  source_sheet?: string;
  source_row?: number;
  import_batch_id?: string;
  fuzzy_matched?: boolean;
  review_required?: boolean;
  original_id?: string;
  [key: string]: unknown;
}

export interface ServicePlan {
  id: string;
  organization_id: string;
  name: string;
  type: ServicePlanType;
  monthly_rate: Paise;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CustomerAccount {
  id: string;
  customer_id: string;
  service_plan_id: string | null;
  portal_account_number: string | null;
  account_type: AccountType;
  status: 'active' | 'inactive' | 'expired' | 'pending';
  start_date: string | null; // YYYY-MM-DD
  end_date: string | null; // YYYY-MM-DD
  auto_renew: boolean;
  created_at: string;
  updated_at: string;
}

export interface BillingRecord {
  id: string;
  organization_id: string;
  customer_account_id: string;
  billing_month: string; // YYYY-MM-DD (1st of month)
  bill_amount: Paise;
  previous_balance: Paise; // SIGNED: negative = customer owes, positive = credit
  discount: Paise;
  total_due: Paise; // COMPUTED: bill_amount - previous_balance - discount
  bill_date: string | null;
  due_date: string | null;
  status: BillingStatus;
  metadata: BillingMetadata;
  created_by: string | null; // employee_id
  created_at: string;
  updated_at: string;
}

export interface BillingMetadata {
  source_sheet?: string;
  source_row?: number;
  import_batch_id?: string;
  manual_override?: boolean;
  pbal_source?: 'auto' | 'manual' | 'carry_forward';
  [key: string]: unknown;
}

export interface PaymentTransaction {
  id: string;
  organization_id: string;
  billing_record_id: string | null; // null for advance/unallocated payments
  customer_id: string;
  employee_id: string | null;
  transaction_date: string; // YYYY-MM-DD
  amount_paid: Paise;
  payment_mode: PaymentMode;
  location: CollectionLocation | null;
  collector_name: string | null; // "Chandan", "Rajib", etc.
  sub_collector: string | null; // "Office Time", "Chandan", etc.
  remarks: string | null;
  due_after_payment: Paise; // COMPUTED: amount_paid - total_due (from billing_record)
  is_offline: boolean;
  sync_status: SyncStatus;
  client_operation_id: string; // UUID v4 - idempotency key
  server_operation_id: string | null; // for conflict resolution
  created_at: string;
  synced_at: string | null;
}

export interface CashbookEntry {
  id: string;
  organization_id: string;
  employee_id: string | null;
  entry_date: string; // YYYY-MM-DD
  category: CashbookCategory;
  particulars: string | null;
  credit_amount: Paise; // Y column (+)
  debit_amount: Paise; // Z column (-)
  running_balance: Paise; // AA column
  remarks: string | null;
  is_system_generated: boolean; // opening/closing balance rows
  client_operation_id: string; // UUID v4
  created_at: string;
  synced_at: string | null;
}

export interface DailySummary {
  id: string;
  organization_id: string;
  summary_date: string; // YYYY-MM-DD
  opening_balance: Paise;
  collector_collection: Paise;
  income: Paise;
  expense: Paise;
  closing_balance: Paise; // COMPUTED: opening + collector + income - expense
  chandan_collection: Paise;
  cash_collection: Paise;
  deposit_return: Paise;
  deposit: Paise;
  commission: Paise;
  salary: Paise;
  advance: Paise;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  organization_id: string;
  employee_id: string | null;
  table_name: string;
  record_id: string | null;
  action: 'insert' | 'update' | 'delete' | 'sync';
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface SyncOperation {
  id: string;
  organization_id: string;
  employee_id: string | null;
  operation_type: 'pull' | 'push' | 'full';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'partial';
  records_processed: number;
  records_failed: number;
  error_details: Record<string, unknown> | null;
  started_at: string;
  completed_at: string | null;
}

export interface ImportBatch {
  id: string;
  organization_id: string;
  source_file: string;
  sheet_name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'rolled_back';
  total_rows: number;
  imported_rows: number;
  failed_rows: number;
  validation_errors: ValidationError[];
  reconciliation_report: ReconciliationReport | null;
  started_at: string;
  completed_at: string | null;
  rolled_back_at: string | null;
}

export interface ValidationError {
  row: number;
  column: string;
  value: unknown;
  message: string;
  severity: 'error' | 'warning';
}

export interface ReconciliationReport {
  total_billed_excel: Paise;
  total_billed_db: Paise;
  total_collected_excel: Paise;
  total_collected_db: Paise;
  total_discounts_excel: Paise;
  total_discounts_db: Paise;
  customer_balances_match: boolean;
  cashbook_income_excel: Paise;
  cashbook_income_db: Paise;
  cashbook_expense_excel: Paise;
  cashbook_expense_db: Paise;
  closing_balance_excel: Paise;
  closing_balance_db: Paise;
  discrepancies: Discrepancy[];
}

export interface Discrepancy {
  type: 'billing' | 'collection' | 'cashbook' | 'summary';
  description: string;
  excel_value: Paise;
  db_value: Paise;
  row_reference?: string;
  severity: 'critical' | 'major' | 'minor';
}

// ============================================
// API Request/Response Types
// ============================================

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface SyncPayload {
  payment_transactions: PaymentTransaction[];
  cashbook_entries: CashbookEntry[];
  customers: Customer[];
  client_timestamp: string;
}

export interface SyncResult {
  synced: number;
  conflicts: ConflictInfo[];
  failed: FailedInfo[];
}

export interface ConflictInfo {
  table: string;
  client_operation_id: string;
  server_record: Record<string, unknown>;
  client_record: Record<string, unknown>;
  resolution: 'server_wins' | 'client_wins' | 'manual_review';
}

export interface FailedInfo {
  table: string;
  client_operation_id: string;
  error: string;
  record: Record<string, unknown>;
}

// ============================================
// Form/Input Types (for validation)
// ============================================

export interface CollectionFormInput {
  customer_id: string;
  transaction_date: string; // YYYY-MM-DD
  amount_paid: number; // rupees, converted to paise
  payment_mode: PaymentMode;
  location: CollectionLocation;
  collector_name: string;
  sub_collector?: string;
  remarks?: string;
  billing_record_id?: string;
}

export interface CashbookFormInput {
  entry_date: string; // YYYY-MM-DD
  category: CashbookCategory;
  particulars: string;
  credit_amount?: number; // rupees
  debit_amount?: number; // rupees
  remarks?: string;
}

export interface CustomerSearchParams {
  query?: string;
  portal_customer_id?: string;
  mobile?: string;
  location?: string;
  status?: CustomerStatus;
  limit?: number;
  offset?: number;
}

export interface DateRangeParams {
  from_date: string; // YYYY-MM-DD
  to_date: string; // YYYY-MM-DD
}

export interface ReportParams extends DateRangeParams {
  collector_name?: string;
  location?: CollectionLocation;
  payment_mode?: PaymentMode;
  group_by?: 'day' | 'week' | 'month' | 'collector' | 'location';
}