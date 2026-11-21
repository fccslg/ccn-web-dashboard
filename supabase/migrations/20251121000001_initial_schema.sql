-- CCN Business Management System - Initial Database Schema
-- Version: 1.0
-- Date: 2025-11-21

-- ============================================
-- Extensions
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- Custom Types (Enums)
-- ============================================

CREATE TYPE payment_mode AS ENUM ('cash', 'gpay', 'upi', 'bank', 'card', 'other');
CREATE TYPE collection_location AS ENUM ('home', 'office', 'field');
CREATE TYPE customer_status AS ENUM ('active', 'inactive', 'suspended');
CREATE TYPE billing_status AS ENUM ('pending', 'partial', 'paid', 'overdue', 'cancelled');
CREATE TYPE cashbook_category AS ENUM (
  'balance', 'collection', 'advance', 'deposit_return', 'deposit',
  'income', 'expense', 'commission', 'salary'
);
CREATE TYPE employee_role AS ENUM ('owner', 'admin', 'collector', 'accountant', 'viewer');
CREATE TYPE sync_status AS ENUM ('pending', 'synced', 'conflict', 'failed');
CREATE TYPE account_type AS ENUM ('cable', 'internet', 'combo');
CREATE TYPE service_plan_type AS ENUM ('cable', 'internet', 'combo');

-- ============================================
-- Helper Functions
-- ============================================

-- Function to get current user's organization_id
CREATE OR REPLACE FUNCTION current_org_id() RETURNS uuid AS $$
  SELECT organization_id
  FROM employees
  WHERE user_id = auth.uid()
  AND is_active = true
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Function to check if user has permission
CREATE OR REPLACE FUNCTION has_permission(perm_name text) RETURNS boolean AS $$
  SELECT permissions->>perm_name = 'true'
  FROM employees
  WHERE user_id = auth.uid()
  AND is_active = true
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- Core Tables
-- ============================================

-- Organizations (multi-tenancy ready)
CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  gst_number text,
  address jsonb,
  settings jsonb NOT NULL DEFAULT '{
    "timezone": "Asia/Kolkata",
    "date_format": "DD-MM-YYYY",
    "currency": "INR",
    "financial_year_start_month": 4,
    "auto_carry_forward_pbal": true,
    "default_payment_mode": "cash"
  }'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Employees (linked to Supabase Auth)
CREATE TABLE employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  role employee_role NOT NULL,
  phone text,
  is_active boolean NOT NULL DEFAULT true,
  permissions jsonb NOT NULL DEFAULT '{
    "can_manage_employees": false,
    "can_manage_customers": false,
    "can_view_all_financials": false,
    "can_approve_corrections": false,
    "can_import_export": false,
    "can_configure_system": false,
    "assigned_locations": [],
    "assigned_collectors": []
  }'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- Customers (master from Combo Ref)
CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  portal_customer_id text NOT NULL, -- LCOID from portal (alphanumeric, preserve exactly)
  name text NOT NULL,
  mobile text,
  address text,
  location text, -- BC Colony, Janata Nagar, etc.
  cable_ref_id text, -- Serial from Cable Ref
  internet_ref_id text, -- ID from Internet Ref (FCCxxx, etc.)
  status customer_status NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, portal_customer_id)
);

-- Service Plans
CREATE TABLE service_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  type service_plan_type NOT NULL,
  monthly_rate bigint NOT NULL, -- paise
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Customer Accounts (subscriptions)
CREATE TABLE customer_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  service_plan_id uuid REFERENCES service_plans(id),
  portal_account_number text,
  account_type account_type NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired', 'pending')),
  start_date date,
  end_date date,
  auto_renew boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Billing Records (monthly bills)
CREATE TABLE billing_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  billing_month date NOT NULL, -- 1st of month
  bill_amount bigint NOT NULL DEFAULT 0, -- paise
  previous_balance bigint NOT NULL DEFAULT 0, -- paise (SIGNED: neg=owes, pos=credit)
  discount bigint NOT NULL DEFAULT 0, -- paise
  total_due bigint GENERATED ALWAYS AS (bill_amount - previous_balance - discount) STORED, -- paise
  bill_date date,
  due_date date,
  status billing_status NOT NULL DEFAULT 'pending',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES employees(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(customer_account_id, billing_month)
);

-- Payment Transactions (collections)
CREATE TABLE payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  billing_record_id uuid REFERENCES billing_records(id) ON DELETE SET NULL,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  transaction_date date NOT NULL,
  amount_paid bigint NOT NULL, -- paise
  payment_mode payment_mode NOT NULL,
  location collection_location,
  collector_name text, -- "Chandan", "Rajib", etc.
  sub_collector text, -- "Office Time", "Chandan", etc.
  remarks text,
  due_after_payment bigint GENERATED ALWAYS AS (
    amount_paid - COALESCE((
      SELECT total_due FROM billing_records WHERE id = payment_transactions.billing_record_id
    ), 0)
  ) STORED,
  is_offline boolean NOT NULL DEFAULT false,
  sync_status sync_status NOT NULL DEFAULT 'synced',
  client_operation_id uuid NOT NULL UNIQUE, -- idempotency key
  server_operation_id uuid, -- for conflict resolution
  created_at timestamptz NOT NULL DEFAULT now(),
  synced_at timestamptz
);

-- Cashbook Entries (daily cash flow)
CREATE TABLE cashbook_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  entry_date date NOT NULL,
  category cashbook_category NOT NULL,
  particulars text,
  credit_amount bigint NOT NULL DEFAULT 0, -- paise (Y column +)
  debit_amount bigint NOT NULL DEFAULT 0, -- paise (Z column -)
  running_balance bigint NOT NULL DEFAULT 0, -- paise (AA column)
  remarks text,
  is_system_generated boolean NOT NULL DEFAULT false, -- opening/closing balance rows
  client_operation_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  synced_at timestamptz
);

-- Daily Summaries (monthly sheet summaries)
CREATE TABLE daily_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  summary_date date NOT NULL,
  opening_balance bigint NOT NULL DEFAULT 0,
  collector_collection bigint NOT NULL DEFAULT 0,
  income bigint NOT NULL DEFAULT 0,
  expense bigint NOT NULL DEFAULT 0,
  closing_balance bigint GENERATED ALWAYS AS (
    opening_balance + collector_collection + income - expense
  ) STORED,
  chandan_collection bigint NOT NULL DEFAULT 0,
  cash_collection bigint NOT NULL DEFAULT 0,
  deposit_return bigint NOT NULL DEFAULT 0,
  deposit bigint NOT NULL DEFAULT 0,
  commission bigint NOT NULL DEFAULT 0,
  salary bigint NOT NULL DEFAULT 0,
  advance bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, summary_date)
);

-- Audit Logs
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  table_name text NOT NULL,
  record_id uuid,
  action text NOT NULL CHECK (action IN ('insert', 'update', 'delete', 'sync')),
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Sync Operations (for offline sync tracking)
CREATE TABLE sync_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  operation_type text NOT NULL CHECK (operation_type IN ('pull', 'push', 'full')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'partial')),
  records_processed bigint NOT NULL DEFAULT 0,
  records_failed bigint NOT NULL DEFAULT 0,
  error_details jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- Import Batches (for Excel migration tracking)
CREATE TABLE import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_file text NOT NULL,
  sheet_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'rolled_back')),
  total_rows bigint NOT NULL DEFAULT 0,
  imported_rows bigint NOT NULL DEFAULT 0,
  failed_rows bigint NOT NULL DEFAULT 0,
  validation_errors jsonb,
  reconciliation_report jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  rolled_back_at timestamptz
);

-- ============================================
-- Indexes for Performance
-- ============================================

-- Customers
CREATE INDEX idx_customers_org_portal ON customers(organization_id, portal_customer_id);
CREATE INDEX idx_customers_org_mobile ON customers(organization_id, mobile);
CREATE INDEX idx_customers_org_location ON customers(organization_id, location);
CREATE INDEX idx_customers_org_status ON customers(organization_id, status);

-- Customer Accounts
CREATE INDEX idx_customer_accounts_customer ON customer_accounts(customer_id);
CREATE INDEX idx_customer_accounts_status ON customer_accounts(status);

-- Billing Records
CREATE INDEX idx_billing_org_month ON billing_records(organization_id, billing_month);
CREATE INDEX idx_billing_account_month ON billing_records(customer_account_id, billing_month);
CREATE INDEX idx_billing_status ON billing_records(status);

-- Payment Transactions
CREATE INDEX idx_payments_org_date ON payment_transactions(organization_id, transaction_date);
CREATE INDEX idx_payments_customer_date ON payment_transactions(customer_id, transaction_date);
CREATE INDEX idx_payments_employee_date ON payment_transactions(employee_id, transaction_date);
CREATE INDEX idx_payments_sync_status ON payment_transactions(sync_status, created_at);
CREATE INDEX idx_payments_client_op_id ON payment_transactions(client_operation_id);
CREATE INDEX idx_payments_billing_record ON payment_transactions(billing_record_id);

-- Cashbook Entries
CREATE INDEX idx_cashbook_org_date ON cashbook_entries(organization_id, entry_date);
CREATE INDEX idx_cashbook_employee_date ON cashbook_entries(employee_id, entry_date);
CREATE INDEX idx_cashbook_category_date ON cashbook_entries(category, entry_date);
CREATE INDEX idx_cashbook_client_op_id ON cashbook_entries(client_operation_id);

-- Daily Summaries
CREATE INDEX idx_summaries_org_date ON daily_summaries(organization_id, summary_date);

-- Audit Logs
CREATE INDEX idx_audit_org_table_record ON audit_logs(organization_id, table_name, record_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);

-- Sync Operations
CREATE INDEX idx_sync_org_status ON sync_operations(organization_id, status);

-- Import Batches
CREATE INDEX idx_import_org_status ON import_batches(organization_id, status);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashbook_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their organization's data
CREATE POLICY "org_isolation" ON organizations
  USING (id = current_org_id());

CREATE POLICY "org_isolation" ON employees
  USING (organization_id = current_org_id());

CREATE POLICY "org_isolation" ON customers
  USING (organization_id = current_org_id());

CREATE POLICY "org_isolation" ON service_plans
  USING (organization_id = current_org_id());

CREATE POLICY "org_isolation" ON customer_accounts
  USING (organization_id = current_org_id());

CREATE POLICY "org_isolation" ON billing_records
  USING (organization_id = current_org_id());

CREATE POLICY "org_isolation" ON payment_transactions
  USING (organization_id = current_org_id());

CREATE POLICY "org_isolation" ON cashbook_entries
  USING (organization_id = current_org_id());

CREATE POLICY "org_isolation" ON daily_summaries
  USING (organization_id = current_org_id());

CREATE POLICY "org_isolation" ON audit_logs
  USING (organization_id = current_org_id());

CREATE POLICY "org_isolation" ON sync_operations
  USING (organization_id = current_org_id());

CREATE POLICY "org_isolation" ON import_batches
  USING (organization_id = current_org_id());

-- Additional role-based policies for payment_transactions
CREATE POLICY "collector_own_payments" ON payment_transactions
  FOR SELECT USING (
    organization_id = current_org_id()
    AND (
      has_permission('can_view_all_financials')
      OR employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "collector_insert_own" ON payment_transactions
  FOR INSERT WITH CHECK (
    organization_id = current_org_id()
    AND employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
  );

-- ============================================
-- Updated At Triggers
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_service_plans_updated_at BEFORE UPDATE ON service_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customer_accounts_updated_at BEFORE UPDATE ON customer_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_billing_records_updated_at BEFORE UPDATE ON billing_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_daily_summaries_updated_at BEFORE UPDATE ON daily_summaries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();