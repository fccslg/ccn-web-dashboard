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
CREATE TRIGGER update_daily_summaries_updated_at BEFORE UPDATE ON daily_summaries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();-- CCN Business Management System - Development Seed Data
-- Run after migrations: supabase db seed

-- ============================================
-- Organization
-- ============================================

INSERT INTO organizations (id, name, code, gst_number, address, settings)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Film Cable Centre (CCN36)',
  'CCN36',
  '19AAACF1234A1Z5',
  '{"line1": "BC Colony", "city": "Siliguri", "state": "West Bengal", "pincode": "734001", "country": "India"}'::jsonb,
  '{"timezone": "Asia/Kolkata", "date_format": "DD-MM-YYYY", "currency": "INR", "financial_year_start_month": 4, "auto_carry_forward_pbal": true, "default_payment_mode": "cash"}'::jsonb
) ON CONFLICT (code) DO NOTHING;

-- ============================================
-- Service Plans (Standard CCN Plans)
-- ============================================

INSERT INTO service_plans (id, organization_id, name, type, monthly_rate, description, is_active) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '11111111-1111-1111-1111-111111111111', 'Cable Basic', 'cable', 20000, 'Basic cable TV package', true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', '11111111-1111-1111-1111-111111111111', 'Cable HD', 'cable', 35000, 'HD cable TV package', true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', '11111111-1111-1111-1111-111111111111', 'Internet 30Mbps', 'internet', 40000, '30 Mbps broadband', true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4', '11111111-1111-1111-1111-111111111111', 'Internet 50Mbps', 'internet', 60000, '50 Mbps broadband', true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5', '11111111-1111-1111-1111-111111111111', 'Combo Basic', 'combo', 50000, 'Cable Basic + Internet 30Mbps', true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa6', '11111111-1111-1111-1111-111111111111', 'Combo Premium', 'combo', 80000, 'Cable HD + Internet 50Mbps', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Employees (will be linked to auth.users after signup)
-- These are placeholder records - actual user_id will be set when employees sign up
-- ============================================

-- Note: In production, these will be created via Supabase Auth sign-up flow
-- For development, we'll create them with known UUIDs that match test auth users

-- Owner: Tarun
INSERT INTO employees (id, organization_id, user_id, name, role, phone, is_active, permissions) VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'Tarun', 'owner', '9832068252', true,
   '{"can_manage_employees": true, "can_manage_customers": true, "can_view_all_financials": true, "can_approve_corrections": true, "can_import_export": true, "can_configure_system": true, "assigned_locations": [], "assigned_collectors": []}'::jsonb)
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Admin/Accountant
INSERT INTO employees (id, organization_id, user_id, name, role, phone, is_active, permissions) VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000002', 'Admin User', 'admin', '9832068253', true,
   '{"can_manage_employees": true, "can_manage_customers": true, "can_view_all_financials": true, "can_approve_corrections": true, "can_import_export": true, "can_configure_system": false, "assigned_locations": [], "assigned_collectors": []}'::jsonb)
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Collector: Chandan
INSERT INTO employees (id, organization_id, user_id, name, role, phone, is_active, permissions) VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee3', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000003', 'Chandan', 'collector', '9382829550', true,
   '{"can_manage_employees": false, "can_manage_customers": false, "can_view_all_financials": false, "can_approve_corrections": false, "can_import_export": false, "can_configure_system": false, "assigned_locations": ["BC Colony", "Janata Nagar", "Dashratpally", "S.R. Colony"], "assigned_collectors": []}'::jsonb)
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Collector: Rajib
INSERT INTO employees (id, organization_id, user_id, name, role, phone, is_active, permissions) VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee4', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000004', 'Rajib', 'collector', '9832068254', true,
   '{"can_manage_employees": false, "can_manage_customers": false, "can_view_all_financials": false, "can_approve_corrections": false, "can_import_export": false, "can_configure_system": false, "assigned_locations": ["Office", "Janata Nagar", "BC Colony"], "assigned_collectors": []}'::jsonb)
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Collector: Choton
INSERT INTO employees (id, organization_id, user_id, name, role, phone, is_active, permissions) VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee5', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000005', 'Choton', 'collector', '9832068255', true,
   '{"can_manage_employees": false, "can_manage_customers": false, "can_view_all_financials": false, "can_approve_corrections": false, "can_import_export": false, "can_configure_system": false, "assigned_locations": ["Office", "BC Colony", "Janata Nagar"], "assigned_collectors": []}'::jsonb)
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- ============================================
-- Sample Customers (from Combo Ref data)
-- ============================================

INSERT INTO customers (id, organization_id, portal_customer_id, name, mobile, address, location, cable_ref_id, internet_ref_id, status, metadata) VALUES
  ('cccccccc-cccc-cccc-cccc-ccccccccccc1', '11111111-1111-1111-1111-111111111111', '100', 'Amal Sanyal', '9832433875', 'BC Colony', 'BC Colony', '13FF00010FBB', null, 'active', '{"source_sheet": "Combo Ref", "source_row": 2}'::jsonb),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc2', '11111111-1111-1111-1111-111111111111', '101', 'Amit Tamang', '9093518879', 'W. Ashram', 'W. Ashram', '1393168EC415', null, 'active', '{"source_sheet": "Combo Ref", "source_row": 3}'::jsonb),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc3', '11111111-1111-1111-1111-111111111111', '102', 'Anima Mandal', '8967924475', 'BC Colony', 'BC Colony', '1393109954B0', null, 'active', '{"source_sheet": "Combo Ref", "source_row": 4}'::jsonb),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc4', '11111111-1111-1111-1111-111111111111', '103', 'Anima Sarkar', '9749051999', 'BC Colony', 'BC Colony', '13FF00010FF0', null, 'active', '{"source_sheet": "Combo Ref", "source_row": 5}'::jsonb),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc5', '11111111-1111-1111-1111-111111111111', '104', 'Anup Saha', '7679518395', 'Janata Nagar', 'Janata Nagar', '139311321695', null, 'active', '{"source_sheet": "Combo Ref", "source_row": 6}'::jsonb),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc6', '11111111-1111-1111-1111-111111111111', '105', 'Apu Sarkar', '9832014456', 'Janata Nagar', 'Janata Nagar', '13931098EF95', null, 'active', '{"source_sheet": "Combo Ref", "source_row": 7}'::jsonb),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc7', '11111111-1111-1111-1111-111111111111', '107', 'Ashish Roy Chowdhury', '9635818483', 'Janata Nagar', 'Janata Nagar', '131511314E2B', null, 'active', '{"source_sheet": "Combo Ref", "source_row": 8}'::jsonb),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc8', '11111111-1111-1111-1111-111111111111', '108', 'Asit Kumar Sarkar', '9851151244', 'W. Ashram', 'W. Ashram', '1393109950CA', null, 'active', '{"source_sheet": "Combo Ref", "source_row": 9}'::jsonb),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc9', '11111111-1111-1111-1111-111111111111', '109', 'Atanu Dakua', '8509734610', 'Dashratpally', 'Dashratpally', '140100098478', null, 'active', '{"source_sheet": "Combo Ref", "source_row": 10}'::jsonb),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc10', '11111111-1111-1111-1111-111111111111', '111', 'Babu Ghosh I', '9933508484', 'Janata Nagar', 'Janata Nagar', '1393142CCAFC', null, 'active', '{"source_sheet": "Combo Ref", "source_row": 11}'::jsonb),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc11', '11111111-1111-1111-1111-111111111111', '114', 'Bani Chakraborty', '9064403551', 'W. Ashram', 'W. Ashram', null, null, 'active', '{"source_sheet": "Combo Ref", "source_row": 12}'::jsonb),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc12', '11111111-1111-1111-1111-111111111111', '116', 'Bela Mondol', '9832470776', 'Janata Nagar', 'Janata Nagar', null, null, 'active', '{"source_sheet": "Combo Ref", "source_row": 13}'::jsonb),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc13', '11111111-1111-1111-1111-111111111111', '119', 'Bijay Biswas', '7864896315', 'BC Colony', 'BC Colony', null, null, 'active', '{"source_sheet": "Combo Ref", "source_row": 14}'::jsonb),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc14', '11111111-1111-1111-1111-111111111111', '122', 'Bikash Biswas', '6295643843', 'BC Colony', 'BC Colony', null, null, 'active', '{"source_sheet": "Combo Ref", "source_row": 15}'::jsonb),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc15', '11111111-1111-1111-1111-111111111111', '123', 'Bikash Mallik', '9832202715', 'Dashratpally', 'Dashratpally', null, null, 'active', '{"source_sheet": "Combo Ref", "source_row": 16}'::jsonb),
  -- Internet customers (different ID format)
  ('cccccccc-cccc-cccc-cccc-ccccccccccc16', '11111111-1111-1111-1111-111111111111', 'FCC036', 'Sampa Das', '9064731473', 'BC Colony', 'BC Colony', null, 'FCC036', 'active', '{"source_sheet": "Internet Ref", "source_row": 2}'::jsonb),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc17', '11111111-1111-1111-1111-111111111111', 'rajusarkar', 'Raju Sarkar', '9832068252', 'Darjeeling more', 'Darjeeling more', null, 'rajusarkar', 'active', '{"source_sheet": "Internet Ref", "source_row": 3}'::jsonb),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc18', '11111111-1111-1111-1111-111111111111', 'biki2022', 'Beeky Roy', '8927749993', 'Janata Nagar', 'Janata Nagar', null, 'biki2022', 'active', '{"source_sheet": "Internet Ref", "source_row": 4}'::jsonb),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc19', '11111111-1111-1111-1111-111111111111', 'FCC014', 'Rabin Sarkar', '9641160461', 'BC Colony', 'BC Colony', null, 'FCC014', 'active', '{"source_sheet": "Internet Ref", "source_row": 5}'::jsonb),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc20', '11111111-1111-1111-1111-111111111111', 'sg2021', 'Chandan Saha', '9382829550', 'BC Colony', 'BC Colony', null, 'sg2021', 'active', '{"source_sheet": "Internet Ref", "source_row": 6}'::jsonb)
ON CONFLICT (organization_id, portal_customer_id) DO NOTHING;

-- ============================================
-- Customer Accounts (link customers to service plans)
-- ============================================

-- Cable accounts
INSERT INTO customer_accounts (id, customer_id, service_plan_id, portal_account_number, account_type, status, start_date, auto_renew) VALUES
  ('accaccac-cacc-cacc-cacc-caccaccaccacc1', 'cccccccc-cccc-cccc-cccc-ccccccccccc1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'C001', 'cable', 'active', '2024-01-01', true),
  ('accaccac-cacc-cacc-cacc-caccaccaccacc2', 'cccccccc-cccc-cccc-cccc-ccccccccccc2', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'C002', 'cable', 'active', '2024-01-01', true),
  ('accaccac-cacc-cacc-cacc-caccaccaccacc3', 'cccccccc-cccc-cccc-cccc-ccccccccccc3', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'C003', 'cable', 'active', '2024-01-01', true),
  ('accaccac-cacc-cacc-cacc-caccaccaccacc4', 'cccccccc-cccc-cccc-cccc-ccccccccccc4', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'C004', 'cable', 'active', '2024-01-01', true),
  ('accaccac-cacc-cacc-cacc-caccaccaccacc5', 'cccccccc-cccc-cccc-cccc-ccccccccccc5', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'C005', 'cable', 'active', '2024-01-01', true),
  ('accaccac-cacc-cacc-cacc-caccaccaccacc6', 'cccccccc-cccc-cccc-cccc-ccccccccccc6', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'C006', 'cable', 'active', '2024-01-01', true),
  ('accaccac-cacc-cacc-cacc-caccaccaccacc7', 'cccccccc-cccc-cccc-cccc-ccccccccccc7', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'C007', 'cable', 'active', '2024-01-01', true),
  ('accaccac-cacc-cacc-cacc-caccaccaccacc8', 'cccccccc-cccc-cccc-cccc-ccccccccccc8', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'C008', 'cable', 'active', '2024-01-01', true),
  ('accaccac-cacc-cacc-cacc-caccaccaccacc9', 'cccccccc-cccc-cccc-cccc-ccccccccccc9', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'C009', 'cable', 'active', '2024-01-01', true),
  ('accaccac-cacc-cacc-cacc-caccaccaccacc10', 'cccccccc-cccc-cccc-cccc-ccccccccccc10', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'C010', 'cable', 'active', '2024-01-01', true),
  ('accaccac-cacc-cacc-cacc-caccaccaccacc11', 'cccccccc-cccc-cccc-cccc-ccccccccccc11', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'C011', 'cable', 'active', '2024-01-01', true),
  ('accaccac-cacc-cacc-cacc-caccaccaccacc12', 'cccccccc-cccc-cccc-cccc-ccccccccccc12', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'C012', 'cable', 'active', '2024-01-01', true),
  ('accaccac-cacc-cacc-cacc-caccaccaccacc13', 'cccccccc-cccc-cccc-cccc-ccccccccccc13', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'C013', 'cable', 'active', '2024-01-01', true),
  ('accaccac-cacc-cacc-cacc-caccaccaccacc14', 'cccccccc-cccc-cccc-cccc-ccccccccccc14', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'C014', 'cable', 'active', '2024-01-01', true),
  ('accaccac-cacc-cacc-cacc-caccaccaccacc15', 'cccccccc-cccc-cccc-cccc-ccccccccccc15', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'C015', 'cable', 'active', '2024-01-01', true)
ON CONFLICT (id) DO NOTHING;

-- Internet accounts
INSERT INTO customer_accounts (id, customer_id, service_plan_id, portal_account_number, account_type, status, start_date, auto_renew) VALUES
  ('accaccac-cacc-cacc-cacc-caccaccaccacc16', 'cccccccc-cccc-cccc-cccc-ccccccccccc16', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'I001', 'internet', 'active', '2024-01-01', true),
  ('accaccac-cacc-cacc-cacc-caccaccaccacc17', 'cccccccc-cccc-cccc-cccc-ccccccccccc17', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'I002', 'internet', 'active', '2024-01-01', true),
  ('accaccac-cacc-cacc-cacc-caccaccaccacc18', 'cccccccc-cccc-cccc-cccc-ccccccccccc18', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'I003', 'internet', 'active', '2024-01-01', true),
  ('accaccac-cacc-cacc-cacc-caccaccaccacc19', 'cccccccc-cccc-cccc-cccc-ccccccccccc19', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'I004', 'internet', 'active', '2024-01-01', true),
  ('accaccac-cacc-cacc-cacc-caccaccaccacc20', 'cccccccc-cccc-cccc-cccc-ccccccccccc20', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'I005', 'internet', 'active', '2024-01-01', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Sample Billing Records (August 2025)
-- ============================================

INSERT INTO billing_records (id, organization_id, customer_account_id, billing_month, bill_amount, previous_balance, discount, bill_date, due_date, status, metadata, created_by) VALUES
  -- August 2025 bills for sample customers
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', '11111111-1111-1111-1111-111111111111', 'accaccac-cacc-cacc-cacc-caccaccaccacc1', '2025-08-01', 41800, -3600, 0, '2025-08-01', '2025-08-10', 'paid', '{"source_sheet": "August", "source_row": 10}'::jsonb, 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee3'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', '11111111-1111-1111-1111-111111111111', 'accaccac-cacc-cacc-cacc-caccaccaccacc2', '2025-08-01', 25500, -500, 0, '2025-08-01', '2025-08-10', 'paid', '{"source_sheet": "August", "source_row": 11}'::jsonb, 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee3'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', '11111111-1111-1111-1111-111111111111', 'accaccac-cacc-cacc-cacc-caccaccaccacc3', '2025-08-01', 38000, -3000, 0, '2025-08-01', '2025-08-10', 'paid', '{"source_sheet": "August", "source_row": 12}'::jsonb, 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee3'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', '11111111-1111-1111-1111-111111111111', 'accaccac-cacc-cacc-cacc-caccaccaccacc4', '2025-08-01', 40000, 0, 0, '2025-08-01', '2025-08-10', 'paid', '{"source_sheet": "August", "source_row": 13}'::jsonb, 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee3'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb5', '11111111-1111-1111-1111-111111111111', 'accaccac-cacc-cacc-cacc-caccaccaccacc5', '2025-08-01', 25000, 0, 0, '2025-08-01', '2025-08-10', 'paid', '{"source_sheet": "August", "source_row": 14}'::jsonb, 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee3'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb6', '11111111-1111-1111-1111-111111111111', 'accaccac-cacc-cacc-cacc-caccaccaccacc6', '2025-08-01', 60000, 0, 0, '2025-08-01', '2025-08-10', 'paid', '{"source_sheet": "August", "source_row": 16}'::jsonb, 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb7', '11111111-1111-1111-1111-111111111111', 'accaccac-cacc-cacc-cacc-caccaccaccacc16', '2025-08-01', 54000, 0, 0, '2025-08-01', '2025-08-10', 'paid', '{"source_sheet": "August", "source_row": 17}'::jsonb, 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb8', '11111111-1111-1111-1111-111111111111', 'accaccac-cacc-cacc-cacc-caccaccaccacc17', '2025-08-01', 105000, 0, 0, '2025-08-01', '2025-08-10', 'paid', '{"source_sheet": "August", "source_row": 18}'::jsonb, 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1')
ON CONFLICT (customer_account_id, billing_month) DO NOTHING;

-- ============================================
-- Sample Payment Transactions (August 2025)
-- ============================================

INSERT INTO payment_transactions (id, organization_id, billing_record_id, customer_id, employee_id, transaction_date, amount_paid, payment_mode, location, collector_name, sub_collector, remarks, is_offline, sync_status, client_operation_id) VALUES
  ('pppppppp-pppp-pppp-pppp-ppppppppppp1', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'cccccccc-cccc-cccc-cccc-ccccccccccc1', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee3', '2025-08-01', 45000, 'cash', 'home', 'Chandan', 'Chandan', null, false, 'synced', 'op-opop-opop-opop-opopopopop1'),
  ('pppppppp-pppp-pppp-pppp-ppppppppppp2', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'cccccccc-cccc-cccc-cccc-ccccccccccc2', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee3', '2025-08-01', 25000, 'cash', 'home', 'Chandan', 'Chandan', null, false, 'synced', 'op-opop-opop-opop-opopopopop2'),
  ('pppppppp-pppp-pppp-pppp-ppppppppppp3', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', 'cccccccc-cccc-cccc-cccc-ccccccccccc3', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee3', '2025-08-01', 38000, 'cash', 'home', 'Chandan', 'Chandan', null, false, 'synced', 'op-opop-opop-opop-opopopopop3'),
  ('pppppppp-pppp-pppp-pppp-ppppppppppp4', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'cccccccc-cccc-cccc-cccc-ccccccccccc4', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee3', '2025-08-01', 40000, 'cash', 'home', 'Chandan', 'Chandan', null, false, 'synced', 'op-opop-opop-opop-opopopopop4'),
  ('pppppppp-pppp-pppp-pppp-ppppppppppp5', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb5', 'cccccccc-cccc-cccc-cccc-ccccccccccc5', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee3', '2025-08-01', 25000, 'cash', 'home', 'Chandan', 'Chandan', null, false, 'synced', 'op-opop-opop-opop-opopopopop5'),
  ('pppppppp-pppp-pppp-pppp-ppppppppppp6', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb6', 'cccccccc-cccc-cccc-cccc-ccccccccccc6', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1', '2025-08-01', 60000, 'gpay', 'home', 'Tarun', 'Office Time', null, false, 'synced', 'op-opop-opop-opop-opopopopop6'),
  ('pppppppp-pppp-pppp-pppp-ppppppppppp7', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb7', 'cccccccc-cccc-cccc-cccc-ccccccccccc16', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1', '2025-08-01', 54000, 'gpay', 'home', 'Tarun', 'Office Time', null, false, 'synced', 'op-opop-opop-opop-opopopopop7'),
  ('pppppppp-pppp-pppp-pppp-ppppppppppp8', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb8', 'cccccccc-cccc-cccc-cccc-ccccccccccc17', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1', '2025-08-01', 105000, 'gpay', 'home', 'Tarun', 'Office Time', null, false, 'synced', 'op-opop-opop-opop-opopopopop8')
ON CONFLICT (client_operation_id) DO NOTHING;

-- ============================================
-- Sample Cashbook Entries (August 1-2, 2025)
-- ============================================

INSERT INTO cashbook_entries (id, organization_id, employee_id, entry_date, category, particulars, credit_amount, debit_amount, running_balance, remarks, is_system_generated, client_operation_id) VALUES
  -- Aug 1 Opening Balance
  ('cacacaca-caca-caca-caca-cacacacacaca1', '11111111-1111-1111-1111-111111111111', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1', '2025-08-01', 'balance', 'Opening Balance', 0, 0, 59200, null, true, 'cb-cbcb-cbcb-cbcb-cbcbcbcbcb1'),
  -- Aug 1 Collections
  ('cacacaca-caca-caca-caca-cacacacacaca2', '11111111-1111-1111-1111-111111111111', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee3', '2025-08-01', 'collection', 'Chandan Collection', 173000, 0, 232200, null, false, 'cb-cbcb-cbcb-cbcb-cbcbcbcbcb2'),
  ('cacacaca-caca-caca-caca-cacacacacaca3', '11111111-1111-1111-1111-111111111111', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee4', '2025-08-01', 'collection', 'Office Cash Collected', 0, 0, 232200, null, false, 'cb-cbcb-cbcb-cbcb-cbcbcbcbcb3'),
  -- Aug 1 Expenses
  ('cacacaca-caca-caca-caca-cacacacacaca4', '11111111-1111-1111-1111-111111111111', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1', '2025-08-01', 'expense', 'Barun Da', 0, 2000, 230200, null, false, 'cb-cbcb-cbcb-cbcb-cbcbcbcbcb4'),
  ('cacacaca-caca-caca-caca-cacacacacaca5', '11111111-1111-1111-1111-111111111111', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1', '2025-08-01', 'expense', 'Barun Da', 0, 1000, 229200, null, false, 'cb-cbcb-cbcb-cbcb-cbcbcbcbcb5'),
  ('cacacaca-caca-caca-caca-cacacacacaca6', '11111111-1111-1111-1111-111111111111', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1', '2025-08-01', 'expense', 'Barun Da', 0, 5000, 224200, null, false, 'cb-cbcb-cbcb-cbcb-cbcbcbcbcb6'),
  -- Aug 1 Closing Balance
  ('cacacaca-caca-caca-caca-cacacacacaca7', '11111111-1111-1111-1111-111111111111', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1', '2025-08-01', 'balance', 'Closing Balance', 0, 0, 224200, null, true, 'cb-cbcb-cbcb-cbcb-cbcbcbcbcb7'),
  -- Aug 2 Opening Balance
  ('cacacaca-caca-caca-caca-cacacacacaca8', '11111111-1111-1111-1111-111111111111', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1', '2025-08-02', 'balance', 'Opening Balance', 0, 0, 224200, null, true, 'cb-cbcb-cbcb-cbcb-cbcbcbcbcb8'),
  -- Aug 2 Collection
  ('cacacaca-caca-caca-caca-cacacacacaca9', '11111111-1111-1111-1111-111111111111', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee3', '2025-08-02', 'collection', 'Chandan Collection', 0, 0, 224200, null, false, 'cb-cbcb-cbcb-cbcb-cbcbcbcbcb9'),
  -- Aug 2 Closing Balance
  ('cacacaca-caca-caca-caca-cacacacacaca10', '11111111-1111-1111-1111-111111111111', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1', '2025-08-02', 'balance', 'Closing Balance', 0, 0, 224200, null, true, 'cb-cbcb-cbcb-cbcb-cbcbcbcbcb10')
ON CONFLICT (client_operation_id) DO NOTHING;

-- ============================================
-- Daily Summary (August 1, 2025)
-- ============================================

INSERT INTO daily_summaries (id, organization_id, summary_date, opening_balance, collector_collection, income, expense, chandan_collection, cash_collection, deposit_return, deposit, commission, salary, advance) VALUES
  ('dddddddd-dddd-dddd-dddd-ddddddddddd1', '11111111-1111-1111-1111-111111111111', '2025-08-01', 59200, 85000, 176000, 420000, 85000, 176000, 200000, 1650000, 0, 950000, 130000)
ON CONFLICT (organization_id, summary_date) DO NOTHING;