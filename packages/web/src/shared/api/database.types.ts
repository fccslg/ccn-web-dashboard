/**
 * Generated Supabase Database Types
 * This file mirrors the schema from ARCHITECTURE.md
 * Run `supabase gen types typescript --local > src/api/database.types.ts` to regenerate
 */

// ============================================
// Enums
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
// JSON Types
// ============================================

export interface Json {
  [key: string]: Json | string | number | boolean | null | Json[];
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
  financial_year_start_month: number;
  auto_carry_forward_pbal: boolean;
  default_payment_mode: PaymentMode;
}

export interface EmployeePermissions {
  can_manage_employees: boolean;
  can_manage_customers: boolean;
  can_view_all_financials: boolean;
  can_approve_corrections: boolean;
  can_import_export: boolean;
  can_configure_system: boolean;
  assigned_locations: string[];
  assigned_collectors: string[];
}

export interface CustomerMetadata {
  source_sheet?: string;
  source_row?: number;
  import_batch_id?: string;
  fuzzy_matched?: boolean;
  review_required?: boolean;
  original_id?: string;
  [key: string]: Json | string | number | boolean | null | undefined;
}

export interface BillingMetadata {
  source_sheet?: string;
  source_row?: number;
  import_batch_id?: string;
  manual_override?: boolean;
  pbal_source?: 'auto' | 'manual' | 'carry_forward';
  [key: string]: Json | string | number | boolean | null | undefined;
}

// ============================================
// Database Schema Types
// ============================================

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          code: string;
          gst_number: string | null;
          address: Address | null;
          settings: OrganizationSettings;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          code: string;
          gst_number?: string | null;
          address?: Address | null;
          settings?: OrganizationSettings;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          code?: string;
          gst_number?: string | null;
          address?: Address | null;
          settings?: OrganizationSettings;
          created_at?: string;
          updated_at?: string;
        };
      };
      employees: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          name: string;
          role: EmployeeRole;
          phone: string | null;
          is_active: boolean;
          permissions: EmployeePermissions;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          name: string;
          role: EmployeeRole;
          phone?: string | null;
          is_active?: boolean;
          permissions?: EmployeePermissions;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string;
          name?: string;
          role?: EmployeeRole;
          phone?: string | null;
          is_active?: boolean;
          permissions?: EmployeePermissions;
          created_at?: string;
          updated_at?: string;
        };
      };
      customers: {
        Row: {
          id: string;
          organization_id: string;
          portal_customer_id: string;
          name: string;
          mobile: string | null;
          address: string | null;
          location: string | null;
          cable_ref_id: string | null;
          internet_ref_id: string | null;
          status: CustomerStatus;
          metadata: CustomerMetadata;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          portal_customer_id: string;
          name: string;
          mobile?: string | null;
          address?: string | null;
          location?: string | null;
          cable_ref_id?: string | null;
          internet_ref_id?: string | null;
          status?: CustomerStatus;
          metadata?: CustomerMetadata;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          portal_customer_id?: string;
          name?: string;
          mobile?: string | null;
          address?: string | null;
          location?: string | null;
          cable_ref_id?: string | null;
          internet_ref_id?: string | null;
          status?: CustomerStatus;
          metadata?: CustomerMetadata;
          created_at?: string;
          updated_at?: string;
        };
      };
      service_plans: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          type: ServicePlanType;
          monthly_rate: number; // paise
          description: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          type: ServicePlanType;
          monthly_rate: number;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          type?: ServicePlanType;
          monthly_rate?: number;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
      };
      customer_accounts: {
        Row: {
          id: string;
          customer_id: string;
          service_plan_id: string | null;
          portal_account_number: string | null;
          account_type: AccountType;
          status: 'active' | 'inactive' | 'expired' | 'pending';
          start_date: string | null;
          end_date: string | null;
          auto_renew: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          service_plan_id?: string | null;
          portal_account_number?: string | null;
          account_type: AccountType;
          status?: 'active' | 'inactive' | 'expired' | 'pending';
          start_date?: string | null;
          end_date?: string | null;
          auto_renew?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          service_plan_id?: string | null;
          portal_account_number?: string | null;
          account_type?: AccountType;
          status?: 'active' | 'inactive' | 'expired' | 'pending';
          start_date?: string | null;
          end_date?: string | null;
          auto_renew?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      billing_records: {
        Row: {
          id: string;
          organization_id: string;
          customer_account_id: string;
          billing_month: string; // YYYY-MM-DD
          bill_amount: number; // paise
          previous_balance: number; // paise, signed
          discount: number; // paise
          total_due: number; // paise, computed
          bill_date: string | null;
          due_date: string | null;
          status: BillingStatus;
          metadata: BillingMetadata;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          customer_account_id: string;
          billing_month: string;
          bill_amount: number;
          previous_balance: number;
          discount?: number;
          bill_date?: string | null;
          due_date?: string | null;
          status?: BillingStatus;
          metadata?: BillingMetadata;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          customer_account_id?: string;
          billing_month?: string;
          bill_amount?: number;
          previous_balance?: number;
          discount?: number;
          bill_date?: string | null;
          due_date?: string | null;
          status?: BillingStatus;
          metadata?: BillingMetadata;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      payment_transactions: {
        Row: {
          id: string;
          organization_id: string;
          billing_record_id: string | null;
          customer_id: string;
          employee_id: string | null;
          transaction_date: string; // YYYY-MM-DD
          amount_paid: number; // paise
          payment_mode: PaymentMode;
          location: CollectionLocation | null;
          collector_name: string | null;
          sub_collector: string | null;
          remarks: string | null;
          due_after_payment: number; // paise, computed
          is_offline: boolean;
          sync_status: SyncStatus;
          client_operation_id: string;
          server_operation_id: string | null;
          created_at: string;
          synced_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          billing_record_id?: string | null;
          customer_id: string;
          employee_id?: string | null;
          transaction_date: string;
          amount_paid: number;
          payment_mode: PaymentMode;
          location?: CollectionLocation | null;
          collector_name?: string | null;
          sub_collector?: string | null;
          remarks?: string | null;
          is_offline?: boolean;
          sync_status?: SyncStatus;
          client_operation_id: string;
          created_at?: string;
          synced_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          billing_record_id?: string | null;
          customer_id?: string;
          employee_id?: string | null;
          transaction_date?: string;
          amount_paid?: number;
          payment_mode?: PaymentMode;
          location?: CollectionLocation | null;
          collector_name?: string | null;
          sub_collector?: string | null;
          remarks?: string | null;
          is_offline?: boolean;
          sync_status?: SyncStatus;
          client_operation_id?: string;
          server_operation_id?: string | null;
          created_at?: string;
          synced_at?: string | null;
        };
      };
      cashbook_entries: {
        Row: {
          id: string;
          organization_id: string;
          employee_id: string | null;
          entry_date: string; // YYYY-MM-DD
          category: CashbookCategory;
          particulars: string | null;
          credit_amount: number; // paise
          debit_amount: number; // paise
          running_balance: number; // paise
          remarks: string | null;
          is_system_generated: boolean;
          client_operation_id: string;
          created_at: string;
          synced_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          employee_id?: string | null;
          entry_date: string;
          category: CashbookCategory;
          particulars?: string | null;
          credit_amount?: number;
          debit_amount?: number;
          running_balance: number;
          remarks?: string | null;
          is_system_generated?: boolean;
          client_operation_id: string;
          created_at?: string;
          synced_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          employee_id?: string | null;
          entry_date?: string;
          category?: CashbookCategory;
          particulars?: string | null;
          credit_amount?: number;
          debit_amount?: number;
          running_balance?: number;
          remarks?: string | null;
          is_system_generated?: boolean;
          client_operation_id?: string;
          created_at?: string;
          synced_at?: string | null;
        };
      };
      daily_summaries: {
        Row: {
          id: string;
          organization_id: string;
          summary_date: string; // YYYY-MM-DD
          opening_balance: number; // paise
          collector_collection: number; // paise
          income: number; // paise
          expense: number; // paise
          closing_balance: number; // paise, computed
          chandan_collection: number; // paise
          cash_collection: number; // paise
          deposit_return: number; // paise
          deposit: number; // paise
          commission: number; // paise
          salary: number; // paise
          advance: number; // paise
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          summary_date: string;
          opening_balance: number;
          collector_collection?: number;
          income?: number;
          expense?: number;
          chandan_collection?: number;
          cash_collection?: number;
          deposit_return?: number;
          deposit?: number;
          commission?: number;
          salary?: number;
          advance?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          summary_date?: string;
          opening_balance?: number;
          collector_collection?: number;
          income?: number;
          expense?: number;
          chandan_collection?: number;
          cash_collection?: number;
          deposit_return?: number;
          deposit?: number;
          commission?: number;
          salary?: number;
          advance?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          organization_id: string;
          employee_id: string | null;
          table_name: string;
          record_id: string | null;
          action: 'insert' | 'update' | 'delete' | 'sync';
          old_values: Json | null;
          new_values: Json | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          employee_id?: string | null;
          table_name: string;
          record_id?: string | null;
          action: 'insert' | 'update' | 'delete' | 'sync';
          old_values?: Json | null;
          new_values?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          employee_id?: string | null;
          table_name?: string;
          record_id?: string | null;
          action?: 'insert' | 'update' | 'delete' | 'sync';
          old_values?: Json | null;
          new_values?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
      };
      sync_operations: {
        Row: {
          id: string;
          organization_id: string;
          employee_id: string | null;
          operation_type: 'pull' | 'push' | 'full';
          status: 'pending' | 'running' | 'completed' | 'failed' | 'partial';
          records_processed: number;
          records_failed: number;
          error_details: Json | null;
          started_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          employee_id?: string | null;
          operation_type: 'pull' | 'push' | 'full';
          status?: 'pending' | 'running' | 'completed' | 'failed' | 'partial';
          records_processed?: number;
          records_failed?: number;
          error_details?: Json | null;
          started_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          employee_id?: string | null;
          operation_type?: 'pull' | 'push' | 'full';
          status?: 'pending' | 'running' | 'completed' | 'failed' | 'partial';
          records_processed?: number;
          records_failed?: number;
          error_details?: Json | null;
          started_at?: string;
          completed_at?: string | null;
        };
      };
      import_batches: {
        Row: {
          id: string;
          organization_id: string;
          source_file: string;
          sheet_name: string;
          status: 'pending' | 'running' | 'completed' | 'failed' | 'rolled_back';
          total_rows: number;
          imported_rows: number;
          failed_rows: number;
          validation_errors: Json | null;
          reconciliation_report: Json | null;
          started_at: string;
          completed_at: string | null;
          rolled_back_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          source_file: string;
          sheet_name: string;
          status?: 'pending' | 'running' | 'completed' | 'failed' | 'rolled_back';
          total_rows?: number;
          imported_rows?: number;
          failed_rows?: number;
          validation_errors?: Json | null;
          reconciliation_report?: Json | null;
          started_at?: string;
          completed_at?: string | null;
          rolled_back_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          source_file?: string;
          sheet_name?: string;
          status?: 'pending' | 'running' | 'completed' | 'failed' | 'rolled_back';
          total_rows?: number;
          imported_rows?: number;
          failed_rows?: number;
          validation_errors?: Json | null;
          reconciliation_report?: Json | null;
          started_at?: string;
          completed_at?: string | null;
          rolled_back_at?: string | null;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      current_org_id: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
    };
    Enums: {
      payment_mode: PaymentMode;
      collection_location: CollectionLocation;
      customer_status: CustomerStatus;
      billing_status: BillingStatus;
      cashbook_category: CashbookCategory;
      employee_role: EmployeeRole;
      sync_status: SyncStatus;
      account_type: AccountType;
      service_plan_type: ServicePlanType;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// ============================================
// Helper Types for Queries
// ============================================

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];

export type Organization = Tables<'organizations'>;
export type Employee = Tables<'employees'>;
export type Customer = Tables<'customers'>;
export type ServicePlan = Tables<'service_plans'>;
export type CustomerAccount = Tables<'customer_accounts'>;
export type BillingRecord = Tables<'billing_records'>;
export type PaymentTransaction = Tables<'payment_transactions'>;
export type CashbookEntry = Tables<'cashbook_entries'>;
export type DailySummary = Tables<'daily_summaries'>;
export type AuditLog = Tables<'audit_logs'>;
export type SyncOperation = Tables<'sync_operations'>;
export type ImportBatch = Tables<'import_batches'>;

export type OrganizationInsert = InsertTables<'organizations'>;
export type EmployeeInsert = InsertTables<'employees'>;
export type CustomerInsert = InsertTables<'customers'>;
export type ServicePlanInsert = InsertTables<'service_plans'>;
export type CustomerAccountInsert = InsertTables<'customer_accounts'>;
export type BillingRecordInsert = InsertTables<'billing_records'>;
export type PaymentTransactionInsert = InsertTables<'payment_transactions'>;
export type CashbookEntryInsert = InsertTables<'cashbook_entries'>;
export type DailySummaryInsert = InsertTables<'daily_summaries'>;
export type AuditLogInsert = InsertTables<'audit_logs'>;
export type SyncOperationInsert = InsertTables<'sync_operations'>;
export type ImportBatchInsert = InsertTables<'import_batches'>;