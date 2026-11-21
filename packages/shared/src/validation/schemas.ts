/**
 * Zod Validation Schemas for CCN Business Management System
 * All financial amounts validated as positive integers (paise)
 */

import { z } from 'zod';

// ============================================
// Primitive Validators
// ============================================

const UUIDSchema = z.string().uuid();

const DateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

const MobileSchema = z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number').optional();

const PortalCustomerIdSchema = z.string().min(1).max(50); // Alphanumeric, preserve exactly

const NonEmptyString = z.string().min(1);

const OptionalString = z.string().optional();

// ============================================
// Enum Validators
// ============================================

const PaymentModeEnum = z.enum(['cash', 'gpay', 'upi', 'bank', 'card', 'other']);
const CollectionLocationEnum = z.enum(['home', 'office', 'field']);
const CustomerStatusEnum = z.enum(['active', 'inactive', 'suspended']);
const BillingStatusEnum = z.enum(['pending', 'partial', 'paid', 'overdue', 'cancelled']);
const CashbookCategoryEnum = z.enum([
  'balance',
  'collection',
  'advance',
  'deposit_return',
  'deposit',
  'income',
  'expense',
  'commission',
  'salary',
]);
const EmployeeRoleEnum = z.enum(['owner', 'admin', 'collector', 'accountant', 'viewer']);
const SyncStatusEnum = z.enum(['pending', 'synced', 'conflict', 'failed']);
const AccountTypeEnum = z.enum(['cable', 'internet', 'combo']);
const ServicePlanTypeEnum = z.enum(['cable', 'internet', 'combo']);

// ============================================
// Form Input Schemas
// ============================================

export const CollectionFormSchema = z.object({
  customer_id: UUIDSchema,
  transaction_date: DateStringSchema,
  amount_paid: z.number().int().positive('Amount must be positive'),
  payment_mode: PaymentModeEnum,
  location: CollectionLocationEnum,
  collector_name: NonEmptyString,
  sub_collector: OptionalString,
  remarks: OptionalString,
  billing_record_id: UUIDSchema.optional(),
});

export const CashbookFormSchema = z.object({
  entry_date: DateStringSchema,
  category: CashbookCategoryEnum,
  particulars: NonEmptyString,
  credit_amount: z.number().int().nonnegative().optional(),
  debit_amount: z.number().int().nonnegative().optional(),
  remarks: OptionalString,
}).refine(
  (data) => (data.credit_amount ?? 0) > 0 || (data.debit_amount ?? 0) > 0,
  {
    message: 'Either credit_amount or debit_amount must be positive',
    path: ['credit_amount'],
  }
);

export const CustomerSearchSchema = z.object({
  query: z.string().optional(),
  portal_customer_id: z.string().optional(),
  mobile: MobileSchema,
  location: z.string().optional(),
  status: CustomerStatusEnum.optional(),
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().nonnegative().default(0),
});

const DateRangeBaseSchema = z.object({
  from_date: DateStringSchema,
  to_date: DateStringSchema,
});

export const DateRangeSchema = DateRangeBaseSchema.refine(
  (data) => data.from_date <= data.to_date,
  { message: 'from_date must be before or equal to to_date', path: ['to_date'] }
);

export const ReportParamsSchema = DateRangeBaseSchema.extend({
  collector_name: z.string().optional(),
  location: CollectionLocationEnum.optional(),
  payment_mode: PaymentModeEnum.optional(),
  group_by: z.enum(['day', 'week', 'month', 'collector', 'location']).optional(),
}).refine(
  (data) => data.from_date <= data.to_date,
  { message: 'from_date must be before or equal to to_date', path: ['to_date'] }
);

// ============================================
// Entity Schemas (for API validation)
// ============================================

export const OrganizationCreateSchema = z.object({
  name: NonEmptyString.max(100),
  code: z.string().min(2).max(20).regex(/^[A-Z0-9_]+$/, 'Code must be uppercase alphanumeric with underscores'),
  gst_number: z.string().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/, 'Invalid GSTIN').optional().nullable(),
  address: z.object({
    line1: NonEmptyString,
    line2: z.string().optional(),
    city: NonEmptyString,
    state: NonEmptyString,
    pincode: z.string().regex(/^\d{6}$/, 'Invalid pincode'),
    country: z.string().default('India'),
  }).optional().nullable(),
  settings: z.object({
    timezone: z.string().default('Asia/Kolkata'),
    date_format: z.string().default('DD-MM-YYYY'),
    currency: z.string().default('INR'),
    financial_year_start_month: z.number().int().min(1).max(12).default(4),
    auto_carry_forward_pbal: z.boolean().default(true),
    default_payment_mode: PaymentModeEnum.default('cash'),
  }).optional(),
});

export const OrganizationUpdateSchema = OrganizationCreateSchema.partial();

export const EmployeeCreateSchema = z.object({
  organization_id: UUIDSchema,
  user_id: UUIDSchema, // Supabase Auth UUID
  name: NonEmptyString.max(100),
  role: EmployeeRoleEnum,
  phone: MobileSchema,
  is_active: z.boolean().default(true),
  permissions: z.object({
    can_manage_employees: z.boolean().default(false),
    can_manage_customers: z.boolean().default(false),
    can_view_all_financials: z.boolean().default(false),
    can_approve_corrections: z.boolean().default(false),
    can_import_export: z.boolean().default(false),
    can_configure_system: z.boolean().default(false),
    assigned_locations: z.array(z.string()).default([]),
    assigned_collectors: z.array(z.string()).default([]),
  }).optional(),
});

export const EmployeeUpdateSchema = EmployeeCreateSchema.partial();

export const CustomerCreateSchema = z.object({
  organization_id: UUIDSchema,
  portal_customer_id: PortalCustomerIdSchema,
  name: NonEmptyString.max(200),
  mobile: MobileSchema,
  address: OptionalString,
  location: z.string().max(100).optional().nullable(),
  cable_ref_id: z.string().max(50).optional().nullable(),
  internet_ref_id: z.string().max(50).optional().nullable(),
  status: CustomerStatusEnum.default('active'),
  metadata: z.record(z.unknown()).default({}),
});

export const CustomerUpdateSchema = CustomerCreateSchema.partial();

export const ServicePlanCreateSchema = z.object({
  organization_id: UUIDSchema,
  name: NonEmptyString.max(100),
  type: ServicePlanTypeEnum,
  monthly_rate: z.number().int().positive('Monthly rate must be positive'),
  description: OptionalString,
  is_active: z.boolean().default(true),
});

export const CustomerAccountCreateSchema = z.object({
  customer_id: UUIDSchema,
  service_plan_id: UUIDSchema.optional().nullable(),
  portal_account_number: z.string().max(50).optional().nullable(),
  account_type: AccountTypeEnum,
  status: z.enum(['active', 'inactive', 'expired', 'pending']).default('active'),
  start_date: DateStringSchema.optional().nullable(),
  end_date: DateStringSchema.optional().nullable(),
  auto_renew: z.boolean().default(true),
}).refine(
  (data) => !data.end_date || !data.start_date || data.start_date <= data.end_date,
  { message: 'start_date must be before end_date', path: ['end_date'] }
);

export const BillingRecordCreateSchema = z.object({
  organization_id: UUIDSchema,
  customer_account_id: UUIDSchema,
  billing_month: DateStringSchema, // Must be 1st of month
  bill_amount: z.number().int().nonnegative(),
  previous_balance: z.number().int(), // SIGNED: can be negative
  discount: z.number().int().nonnegative().default(0),
  bill_date: DateStringSchema.optional().nullable(),
  due_date: DateStringSchema.optional().nullable(),
  status: BillingStatusEnum.default('pending'),
  metadata: z.record(z.unknown()).default({}),
  created_by: UUIDSchema.optional().nullable(),
}).refine(
  (data) => data.billing_month.endsWith('-01'),
  { message: 'billing_month must be the 1st of the month (YYYY-MM-01)', path: ['billing_month'] }
);

export const PaymentTransactionCreateSchema = z.object({
  organization_id: UUIDSchema,
  billing_record_id: UUIDSchema.optional().nullable(),
  customer_id: UUIDSchema,
  employee_id: UUIDSchema.optional().nullable(),
  transaction_date: DateStringSchema,
  amount_paid: z.number().int().positive('Amount paid must be positive'),
  payment_mode: PaymentModeEnum,
  location: CollectionLocationEnum.optional().nullable(),
  collector_name: NonEmptyString.max(100),
  sub_collector: OptionalString,
  remarks: OptionalString,
  is_offline: z.boolean().default(false),
  sync_status: SyncStatusEnum.default('synced'),
  client_operation_id: UUIDSchema, // Must be provided by client
});

export const CashbookEntryCreateSchema = z.object({
  organization_id: UUIDSchema,
  employee_id: UUIDSchema.optional().nullable(),
  entry_date: DateStringSchema,
  category: CashbookCategoryEnum,
  particulars: NonEmptyString.max(500),
  credit_amount: z.number().int().nonnegative().default(0),
  debit_amount: z.number().int().nonnegative().default(0),
  running_balance: z.number().int(), // Can be negative
  remarks: OptionalString,
  is_system_generated: z.boolean().default(false),
  client_operation_id: UUIDSchema,
}).refine(
  (data) => data.credit_amount > 0 || data.debit_amount > 0,
  { message: 'Either credit_amount or debit_amount must be positive', path: ['credit_amount'] }
);

export const DailySummaryCreateSchema = z.object({
  organization_id: UUIDSchema,
  summary_date: DateStringSchema,
  opening_balance: z.number().int(),
  collector_collection: z.number().int().nonnegative().default(0),
  income: z.number().int().nonnegative().default(0),
  expense: z.number().int().nonnegative().default(0),
  chandan_collection: z.number().int().nonnegative().default(0),
  cash_collection: z.number().int().nonnegative().default(0),
  deposit_return: z.number().int().nonnegative().default(0),
  deposit: z.number().int().nonnegative().default(0),
  commission: z.number().int().nonnegative().default(0),
  salary: z.number().int().nonnegative().default(0),
  advance: z.number().int().nonnegative().default(0),
});

// ============================================
// Import/Export Schemas
// ============================================

export const ImportBatchCreateSchema = z.object({
  organization_id: UUIDSchema,
  source_file: NonEmptyString,
  sheet_name: NonEmptyString,
});

export const ValidationErrorSchema = z.object({
  row: z.number().int().positive(),
  column: NonEmptyString,
  value: z.unknown(),
  message: NonEmptyString,
  severity: z.enum(['error', 'warning']),
});

export const DiscrepancySchema = z.object({
  type: z.enum(['billing', 'collection', 'cashbook', 'summary']),
  description: NonEmptyString,
  excel_value: z.number().int(),
  db_value: z.number().int(),
  row_reference: z.string().optional(),
  severity: z.enum(['critical', 'major', 'minor']),
});

export const ReconciliationReportSchema = z.object({
  total_billed_excel: z.number().int(),
  total_billed_db: z.number().int(),
  total_collected_excel: z.number().int(),
  total_collected_db: z.number().int(),
  total_discounts_excel: z.number().int(),
  total_discounts_db: z.number().int(),
  customer_balances_match: z.boolean(),
  cashbook_income_excel: z.number().int(),
  cashbook_income_db: z.number().int(),
  cashbook_expense_excel: z.number().int(),
  cashbook_expense_db: z.number().int(),
  closing_balance_excel: z.number().int(),
  closing_balance_db: z.number().int(),
  discrepancies: z.array(DiscrepancySchema),
});

// ============================================
// Type Exports (inferred from schemas - for validation inputs)
// Note: These are the Zod-inferred types for form validation
// The canonical TypeScript interfaces are in ../types/index.ts
// ============================================

export type CollectionFormInput = z.infer<typeof CollectionFormSchema>;
export type CashbookFormInput = z.infer<typeof CashbookFormSchema>;
export type CustomerSearchParams = z.infer<typeof CustomerSearchSchema>;
export type DateRangeParams = z.infer<typeof DateRangeSchema>;
export type ReportParams = z.infer<typeof ReportParamsSchema>;
export type OrganizationCreateInput = z.infer<typeof OrganizationCreateSchema>;
export type EmployeeCreateInput = z.infer<typeof EmployeeCreateSchema>;
export type CustomerCreateInput = z.infer<typeof CustomerCreateSchema>;
export type ServicePlanCreateInput = z.infer<typeof ServicePlanCreateSchema>;
export type CustomerAccountCreateInput = z.infer<typeof CustomerAccountCreateSchema>;
export type BillingRecordCreateInput = z.infer<typeof BillingRecordCreateSchema>;
export type PaymentTransactionCreateInput = z.infer<typeof PaymentTransactionCreateSchema>;
export type CashbookEntryCreateInput = z.infer<typeof CashbookEntryCreateSchema>;
export type DailySummaryCreateInput = z.infer<typeof DailySummaryCreateSchema>;
export type ImportBatchCreateInput = z.infer<typeof ImportBatchCreateSchema>;
export type ValidationError = z.infer<typeof ValidationErrorSchema>;
export type Discrepancy = z.infer<typeof DiscrepancySchema>;
export type ReconciliationReport = z.infer<typeof ReconciliationReportSchema>;

// ============================================
// Validation Helpers
// ============================================

export function validateCollectionForm(data: unknown): CollectionFormInput {
  return CollectionFormSchema.parse(data);
}

export function validateCashbookForm(data: unknown): CashbookFormInput {
  return CashbookFormSchema.parse(data);
}

export function validateCustomerSearch(data: unknown): CustomerSearchParams {
  return CustomerSearchSchema.parse(data);
}

export function validateDateRange(data: unknown): DateRangeParams {
  return DateRangeSchema.parse(data);
}

export function validateReportParams(data: unknown): ReportParams {
  return ReportParamsSchema.parse(data);
}

export function validatePaymentTransaction(data: unknown): PaymentTransactionCreateInput {
  return PaymentTransactionCreateSchema.parse(data);
}

export function validateCashbookEntry(data: unknown): CashbookEntryCreateInput {
  return CashbookEntryCreateSchema.parse(data);
}