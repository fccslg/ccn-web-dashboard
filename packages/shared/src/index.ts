/**
 * @ccn/shared - Shared Types, Validation, Constants, Utilities, and API Client
 * Main entry point for the shared package
 */

// Core Types (from types/index.ts) - these are the canonical TypeScript interfaces
export * from './types';

// Validation Schemas (Zod schemas only - no type exports to avoid conflicts)
export {
  // Validation functions
  validateCollectionForm,
  validateCashbookForm,
  validateCustomerSearch,
  validateDateRange,
  validateReportParams,
  validatePaymentTransaction,
  validateCashbookEntry,
  // Zod schemas
  CollectionFormSchema,
  CashbookFormSchema,
  CustomerSearchSchema,
  DateRangeSchema,
  ReportParamsSchema,
  OrganizationCreateSchema,
  EmployeeCreateSchema,
  CustomerCreateSchema,
  ServicePlanCreateSchema,
  CustomerAccountCreateSchema,
  BillingRecordCreateSchema,
  PaymentTransactionCreateSchema,
  CashbookEntryCreateSchema,
  DailySummaryCreateSchema,
  ImportBatchCreateSchema,
  ValidationErrorSchema,
  DiscrepancySchema,
  ReconciliationReportSchema,
} from './validation/schemas';

// Constants
export * from './constants';

// Utilities
export * from './utils';

// API Client
export * from './api/supabase';

// Database Types (generated from Supabase)
export type {
  Database,
  Tables,
  InsertTables,
  UpdateTables,
  Organization,
  Employee,
  Customer,
  ServicePlan,
  CustomerAccount,
  BillingRecord,
  PaymentTransaction,
  CashbookEntry,
  DailySummary,
  AuditLog,
  SyncOperation,
  ImportBatch,
  OrganizationInsert,
  EmployeeInsert,
  CustomerInsert,
  ServicePlanInsert,
  CustomerAccountInsert,
  BillingRecordInsert,
  PaymentTransactionInsert,
  CashbookEntryInsert,
  DailySummaryInsert,
  AuditLogInsert,
  SyncOperationInsert,
  ImportBatchInsert,
} from './api/database.types';