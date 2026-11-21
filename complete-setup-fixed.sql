-- CCN Business Management System - Complete Database Setup (Fixed Order + Valid UUIDs)
-- Run this in Supabase Dashboard SQL Editor
-- Project: hntbgypndjyksgjbgjtj

-- ============================================
-- 1. EXTENSIONS
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 2. CUSTOM TYPES (ENUMs)
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
-- 3. TABLES (in dependency order)
-- ============================================

-- Organizations (no dependencies)
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

-- Employees (depends on organizations, auth.users)
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

-- Customers (depends on organizations)
CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  portal_customer_id text NOT NULL,
  name text NOT NULL,
  mobile text,
  address text,
  location text,
  cable_ref_id text,
  internet_ref_id text,
  status customer_status NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, portal_customer_id)
);

-- Service Plans (depends on organizations)
CREATE TABLE service_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  type service_plan_type NOT NULL,
  monthly_rate bigint NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Customer Accounts (depends on customers, service_plans)
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

-- Billing Records (depends on customer_accounts, organizations, employees)
CREATE TABLE billing_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  billing_month date NOT NULL,
  bill_amount bigint NOT NULL DEFAULT 0,
  previous_balance bigint NOT NULL DEFAULT 0,
  discount bigint NOT NULL DEFAULT 0,
  total_due bigint GENERATED ALWAYS AS (bill_amount - previous_balance - discount) STORED,
  bill_date date,
  due_date date,
  status billing_status NOT NULL DEFAULT 'pending',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES employees(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(customer_account_id, billing_month)
);

-- Payment Transactions (depends on billing_records, customers, employees, organizations)
CREATE TABLE payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  billing_record_id uuid REFERENCES billing_records(id) ON DELETE SET NULL,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  transaction_date date NOT NULL,
  amount_paid bigint NOT NULL,
  payment_mode payment_mode NOT NULL,
  location collection_location,
  collector_name text,
  sub_collector text,
  remarks text,
  due_after_payment bigint NOT NULL DEFAULT 0,
  is_offline boolean NOT NULL DEFAULT false,
  sync_status sync_status NOT NULL DEFAULT 'synced',
  client_operation_id uuid NOT NULL UNIQUE,
  server_operation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  synced_at timestamptz
);

-- Cashbook Entries (depends on organizations, employees)
CREATE TABLE cashbook_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  entry_date date NOT NULL,
  category cashbook_category NOT NULL,
  particulars text,
  credit_amount bigint NOT NULL DEFAULT 0,
  debit_amount bigint NOT NULL DEFAULT 0,
  running_balance bigint NOT NULL DEFAULT 0,
  remarks text,
  is_system_generated boolean NOT NULL DEFAULT false,
  client_operation_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  synced_at timestamptz
);

-- Daily Summaries (depends on organizations)
CREATE TABLE daily_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  summary_date date NOT NULL,
  opening_balance bigint NOT NULL DEFAULT 0,
  collector_collection bigint NOT NULL DEFAULT 0,
  income bigint NOT NULL DEFAULT 0,
  expense bigint NOT NULL DEFAULT 0,
  closing_balance bigint NOT NULL DEFAULT 0,
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

-- Audit Logs (depends on organizations, employees)
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

-- Sync Operations (depends on organizations, employees)
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

-- Import Batches (depends on organizations)
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
-- 4. INDEXES
-- ============================================

CREATE INDEX idx_customers_org_portal ON customers(organization_id, portal_customer_id);
CREATE INDEX idx_customers_org_mobile ON customers(organization_id, mobile);
CREATE INDEX idx_customers_org_location ON customers(organization_id, location);
CREATE INDEX idx_customers_org_status ON customers(organization_id, status);

CREATE INDEX idx_customer_accounts_customer ON customer_accounts(customer_id);
CREATE INDEX idx_customer_accounts_status ON customer_accounts(status);

CREATE INDEX idx_billing_org_month ON billing_records(organization_id, billing_month);
CREATE INDEX idx_billing_account_month ON billing_records(customer_account_id, billing_month);
CREATE INDEX idx_billing_status ON billing_records(status);

CREATE INDEX idx_payments_org_date ON payment_transactions(organization_id, transaction_date);
CREATE INDEX idx_payments_customer_date ON payment_transactions(customer_id, transaction_date);
CREATE INDEX idx_payments_employee_date ON payment_transactions(employee_id, transaction_date);
CREATE INDEX idx_payments_sync_status ON payment_transactions(sync_status, created_at);
CREATE INDEX idx_payments_client_op_id ON payment_transactions(client_operation_id);
CREATE INDEX idx_payments_billing_record ON payment_transactions(billing_record_id);

CREATE INDEX idx_cashbook_org_date ON cashbook_entries(organization_id, entry_date);
CREATE INDEX idx_cashbook_employee_date ON cashbook_entries(employee_id, entry_date);
CREATE INDEX idx_cashbook_category_date ON cashbook_entries(category, entry_date);
CREATE INDEX idx_cashbook_client_op_id ON cashbook_entries(client_operation_id);

CREATE INDEX idx_summaries_org_date ON daily_summaries(organization_id, summary_date);

CREATE INDEX idx_audit_org_table_record ON audit_logs(organization_id, table_name, record_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);

CREATE INDEX idx_sync_org_status ON sync_operations(organization_id, status);

CREATE INDEX idx_import_org_status ON import_batches(organization_id, status);

-- ============================================
-- 5. HELPER FUNCTIONS (after tables exist)
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. TRIGGERS (after functions exist)
-- ============================================

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_service_plans_updated_at BEFORE UPDATE ON service_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customer_accounts_updated_at BEFORE UPDATE ON customer_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_billing_records_updated_at BEFORE UPDATE ON billing_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_daily_summaries_updated_at BEFORE UPDATE ON daily_summaries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 7. ROW LEVEL SECURITY (after all tables exist)
-- ============================================

-- Helper function to get org_id with RLS bypassed (SECURITY DEFINER + row_security = off)
CREATE OR REPLACE FUNCTION get_current_org_id() RETURNS uuid AS $$
  SET row_security = off;
  SELECT organization_id
  FROM employees
  WHERE user_id = auth.uid()
  AND is_active = true
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER VOLATILE;

-- Function to check permissions with RLS bypassed
CREATE OR REPLACE FUNCTION check_permission(perm_name text) RETURNS boolean AS $$
  SET row_security = off;
  SELECT permissions->>perm_name = 'true'
  FROM employees
  WHERE user_id = auth.uid()
  AND is_active = true
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER VOLATILE;

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

-- Employees: direct check on user_id (no function call to avoid circular dependency)
CREATE POLICY "employees_own" ON employees USING (user_id = auth.uid());

-- Organizations: check if user's org matches
CREATE POLICY "organizations_own" ON organizations USING (id = get_current_org_id());

-- Other tables: use get_current_org_id() which bypasses RLS
-- Tables with direct organization_id column
CREATE POLICY "org_isolation" ON customers USING (organization_id = get_current_org_id());
CREATE POLICY "org_isolation" ON service_plans USING (organization_id = get_current_org_id());
CREATE POLICY "org_isolation" ON billing_records USING (organization_id = get_current_org_id());
CREATE POLICY "org_isolation" ON payment_transactions USING (organization_id = get_current_org_id());
CREATE POLICY "org_isolation" ON cashbook_entries USING (organization_id = get_current_org_id());
CREATE POLICY "org_isolation" ON daily_summaries USING (organization_id = get_current_org_id());
CREATE POLICY "org_isolation" ON audit_logs USING (organization_id = get_current_org_id());
CREATE POLICY "org_isolation" ON sync_operations USING (organization_id = get_current_org_id());
CREATE POLICY "org_isolation" ON import_batches USING (organization_id = get_current_org_id());

-- customer_accounts doesn't have organization_id, join through customers
CREATE POLICY "org_isolation" ON customer_accounts
  USING (customer_id IN (SELECT id FROM customers WHERE organization_id = get_current_org_id()));

-- Collector-specific policies
CREATE POLICY "collector_own_payments" ON payment_transactions
  FOR SELECT USING (
    organization_id = get_current_org_id()
    AND (
      check_permission('can_view_all_financials')
      OR employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "collector_insert_own" ON payment_transactions
  FOR INSERT WITH CHECK (
    organization_id = get_current_org_id()
    AND employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
  );

-- ============================================
-- 8. SEED DATA (last)
-- ============================================

-- Organization
INSERT INTO organizations (id, name, code, gst_number, address, settings)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Film Cable Centre (CCN36)',
  'CCN36',
  '19AAACF1234A1Z5',
  '{"line1": "BC Colony", "city": "Siliguri", "state": "West Bengal", "pincode": "734001", "country": "India"}'::jsonb,
  '{"timezone": "Asia/Kolkata", "date_format": "DD-MM-YYYY", "currency": "INR", "financial_year_start_month": 4, "auto_carry_forward_pbal": true, "default_payment_mode": "cash"}'::jsonb
) ON CONFLICT (code) DO NOTHING;

-- Service Plans
INSERT INTO service_plans (id, organization_id, name, type, monthly_rate, description, is_active) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '11111111-1111-1111-1111-111111111111', 'Cable Basic', 'cable', 20000, 'Basic cable TV package', true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', '11111111-1111-1111-1111-111111111111', 'Cable HD', 'cable', 35000, 'HD cable TV package', true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', '11111111-1111-1111-1111-111111111111', 'Internet 30Mbps', 'internet', 40000, '30 Mbps broadband', true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4', '11111111-1111-1111-1111-111111111111', 'Internet 50Mbps', 'internet', 60000, '50 Mbps broadband', true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5', '11111111-1111-1111-1111-111111111111', 'Combo Basic', 'combo', 50000, 'Cable Basic + Internet 30Mbps', true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa6', '11111111-1111-1111-1111-111111111111', 'Combo Premium', 'combo', 80000, 'Cable HD + Internet 50Mbps', true)
ON CONFLICT (id) DO NOTHING;

-- Note: Employees require auth.users entries first.
-- Create these via Supabase Auth dashboard or signup flow, then run:
/*
INSERT INTO employees (id, organization_id, user_id, name, role, phone, is_active, permissions) VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1', '11111111-1111-1111-1111-111111111111', '<AUTH_USER_ID_TARUN>', 'Tarun', 'owner', '9832068252', true,
   '{"can_manage_employees": true, "can_manage_customers": true, "can_view_all_financials": true, "can_approve_corrections": true, "can_import_export": true, "can_configure_system": true, "assigned_locations": [], "assigned_collectors": []}'::jsonb),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2', '11111111-1111-1111-1111-111111111111', '<AUTH_USER_ID_ADMIN>', 'Admin User', 'admin', '9832068253', true,
   '{"can_manage_employees": true, "can_manage_customers": true, "can_view_all_financials": true, "can_approve_corrections": true, "can_import_export": true, "can_configure_system": false, "assigned_locations": [], "assigned_collectors": []}'::jsonb),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee3', '11111111-1111-1111-1111-111111111111', '<AUTH_USER_ID_CHANDAN>', 'Chandan', 'collector', '9382829550', true,
   '{"can_manage_employees": false, "can_manage_customers": false, "can_view_all_financials": false, "can_approve_corrections": false, "can_import_export": false, "can_configure_system": false, "assigned_locations": ["BC Colony", "Janata Nagar", "Dashratpally", "S.R. Colony"], "assigned_collectors": []}'::jsonb),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee4', '11111111-1111-1111-1111-111111111111', '<AUTH_USER_ID_RAJIB>', 'Rajib', 'collector', '9832068254', true,
   '{"can_manage_employees": false, "can_manage_customers": false, "can_view_all_financials": false, "can_approve_corrections": false, "can_import_export": false, "can_configure_system": false, "assigned_locations": ["Office", "Janata Nagar", "BC Colony"], "assigned_collectors": []}'::jsonb),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee5', '11111111-1111-1111-1111-111111111111', '<AUTH_USER_ID_CHOTON>', 'Choton', 'collector', '9832068255', true,
   '{"can_manage_employees": false, "can_manage_customers": false, "can_view_all_financials": false, "can_approve_corrections": false, "can_import_export": false, "can_configure_system": false, "assigned_locations": ["Office", "BC Colony", "Janata Nagar"], "assigned_collectors": []}'::jsonb)
ON CONFLICT (organization_id, user_id) DO NOTHING;
*/

-- Customers (from Combo Ref) - Valid UUIDs (only 0-9, a-f)
INSERT INTO customers (id, organization_id, portal_customer_id, name, mobile, address, location, cable_ref_id, internet_ref_id, status, metadata) VALUES
  ('c1000000-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', '100', 'Amal Sanyal', '9832433875', 'BC Colony', 'BC Colony', '13FF00010FBB', null, 'active', '{"source_sheet": "Combo Ref", "source_row": 2}'::jsonb),
  ('c1000000-0000-4000-8000-000000000002', '11111111-1111-1111-1111-111111111111', '101', 'Amit Tamang', '9093518879', 'W. Ashram', 'W. Ashram', '1393168EC415', null, 'active', '{"source_sheet": "Combo Ref", "source_row": 3}'::jsonb),
  ('c1000000-0000-4000-8000-000000000003', '11111111-1111-1111-1111-111111111111', '102', 'Anima Mandal', '8967924475', 'BC Colony', 'BC Colony', '1393109954B0', null, 'active', '{"source_sheet": "Combo Ref", "source_row": 4}'::jsonb),
  ('c1000000-0000-4000-8000-000000000004', '11111111-1111-1111-1111-111111111111', '103', 'Anima Sarkar', '9749051999', 'BC Colony', 'BC Colony', '13FF00010FF0', null, 'active', '{"source_sheet": "Combo Ref", "source_row": 5}'::jsonb),
  ('c1000000-0000-4000-8000-000000000005', '11111111-1111-1111-1111-111111111111', '104', 'Anup Saha', '7679518395', 'Janata Nagar', 'Janata Nagar', '139311321695', null, 'active', '{"source_sheet": "Combo Ref", "source_row": 6}'::jsonb),
  ('c1000000-0000-4000-8000-000000000006', '11111111-1111-1111-1111-111111111111', '105', 'Apu Sarkar', '9832014456', 'Janata Nagar', 'Janata Nagar', '13931098EF95', null, 'active', '{"source_sheet": "Combo Ref", "source_row": 7}'::jsonb),
  ('c1000000-0000-4000-8000-000000000007', '11111111-1111-1111-1111-111111111111', '107', 'Ashish Roy Chowdhury', '9635818483', 'Janata Nagar', 'Janata Nagar', '131511314E2B', null, 'active', '{"source_sheet": "Combo Ref", "source_row": 8}'::jsonb),
  ('c1000000-0000-4000-8000-000000000008', '11111111-1111-1111-1111-111111111111', '108', 'Asit Kumar Sarkar', '9851151244', 'W. Ashram', 'W. Ashram', '1393109950CA', null, 'active', '{"source_sheet": "Combo Ref", "source_row": 9}'::jsonb),
  ('c1000000-0000-4000-8000-000000000009', '11111111-1111-1111-1111-111111111111', '109', 'Atanu Dakua', '8509734610', 'Dashratpally', 'Dashratpally', '140100098478', null, 'active', '{"source_sheet": "Combo Ref", "source_row": 10}'::jsonb),
  ('c1000000-0000-4000-8000-00000000000a', '11111111-1111-1111-1111-111111111111', '111', 'Babu Ghosh I', '9933508484', 'Janata Nagar', 'Janata Nagar', '1393142CCAFC', null, 'active', '{"source_sheet": "Combo Ref", "source_row": 11}'::jsonb),
  ('c1000000-0000-4000-8000-00000000000b', '11111111-1111-1111-1111-111111111111', '114', 'Bani Chakraborty', '9064403551', 'W. Ashram', 'W. Ashram', null, null, 'active', '{"source_sheet": "Combo Ref", "source_row": 12}'::jsonb),
  ('c1000000-0000-4000-8000-00000000000c', '11111111-1111-1111-1111-111111111111', '116', 'Bela Mondol', '9832470776', 'Janata Nagar', 'Janata Nagar', null, null, 'active', '{"source_sheet": "Combo Ref", "source_row": 13}'::jsonb),
  ('c1000000-0000-4000-8000-00000000000d', '11111111-1111-1111-1111-111111111111', '119', 'Bijay Biswas', '7864896315', 'BC Colony', 'BC Colony', null, null, 'active', '{"source_sheet": "Combo Ref", "source_row": 14}'::jsonb),
  ('c1000000-0000-4000-8000-00000000000e', '11111111-1111-1111-1111-111111111111', '122', 'Bikash Biswas', '6295643843', 'BC Colony', 'BC Colony', null, null, 'active', '{"source_sheet": "Combo Ref", "source_row": 15}'::jsonb),
  ('c1000000-0000-4000-8000-00000000000f', '11111111-1111-1111-1111-111111111111', '123', 'Bikash Mallik', '9832202715', 'Dashratpally', 'Dashratpally', null, null, 'active', '{"source_sheet": "Combo Ref", "source_row": 16}'::jsonb),
  ('c1000000-0000-4000-8000-000000000010', '11111111-1111-1111-1111-111111111111', 'FCC036', 'Sampa Das', '9064731473', 'BC Colony', 'BC Colony', null, 'FCC036', 'active', '{"source_sheet": "Internet Ref", "source_row": 2}'::jsonb),
  ('c1000000-0000-4000-8000-000000000011', '11111111-1111-1111-1111-111111111111', 'rajusarkar', 'Raju Sarkar', '9832068252', 'Darjeeling more', 'Darjeeling more', null, 'rajusarkar', 'active', '{"source_sheet": "Internet Ref", "source_row": 3}'::jsonb),
  ('c1000000-0000-4000-8000-000000000012', '11111111-1111-1111-1111-111111111111', 'biki2022', 'Beeky Roy', '8927749993', 'Janata Nagar', 'Janata Nagar', null, 'biki2022', 'active', '{"source_sheet": "Internet Ref", "source_row": 4}'::jsonb),
  ('c1000000-0000-4000-8000-000000000013', '11111111-1111-1111-1111-111111111111', 'FCC014', 'Rabin Sarkar', '9641160461', 'BC Colony', 'BC Colony', null, 'FCC014', 'active', '{"source_sheet": "Internet Ref", "source_row": 5}'::jsonb),
  ('c1000000-0000-4000-8000-000000000014', '11111111-1111-1111-1111-111111111111', 'sg2021', 'Chandan Saha', '9382829550', 'BC Colony', 'BC Colony', null, 'sg2021', 'active', '{"source_sheet": "Internet Ref", "source_row": 6}'::jsonb)
ON CONFLICT (organization_id, portal_customer_id) DO NOTHING;

-- Customer Accounts
INSERT INTO customer_accounts (id, customer_id, service_plan_id, portal_account_number, account_type, status, start_date, auto_renew) VALUES
  ('a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'C001', 'cable', 'active', '2024-01-01', true),
  ('a1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'C002', 'cable', 'active', '2024-01-01', true),
  ('a1000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'C003', 'cable', 'active', '2024-01-01', true),
  ('a1000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'C004', 'cable', 'active', '2024-01-01', true),
  ('a1000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000005', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'C005', 'cable', 'active', '2024-01-01', true),
  ('a1000000-0000-4000-8000-000000000006', 'c1000000-0000-4000-8000-000000000006', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'C006', 'cable', 'active', '2024-01-01', true),
  ('a1000000-0000-4000-8000-000000000007', 'c1000000-0000-4000-8000-000000000007', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'C007', 'cable', 'active', '2024-01-01', true),
  ('a1000000-0000-4000-8000-000000000008', 'c1000000-0000-4000-8000-000000000008', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'C008', 'cable', 'active', '2024-01-01', true),
  ('a1000000-0000-4000-8000-000000000009', 'c1000000-0000-4000-8000-000000000009', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'C009', 'cable', 'active', '2024-01-01', true),
  ('a1000000-0000-4000-8000-00000000000a', 'c1000000-0000-4000-8000-00000000000a', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'C010', 'cable', 'active', '2024-01-01', true),
  ('a1000000-0000-4000-8000-00000000000b', 'c1000000-0000-4000-8000-00000000000b', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'C011', 'cable', 'active', '2024-01-01', true),
  ('a1000000-0000-4000-8000-00000000000c', 'c1000000-0000-4000-8000-00000000000c', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'C012', 'cable', 'active', '2024-01-01', true),
  ('a1000000-0000-4000-8000-00000000000d', 'c1000000-0000-4000-8000-00000000000d', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'C013', 'cable', 'active', '2024-01-01', true),
  ('a1000000-0000-4000-8000-00000000000e', 'c1000000-0000-4000-8000-00000000000e', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'C014', 'cable', 'active', '2024-01-01', true),
  ('a1000000-0000-4000-8000-00000000000f', 'c1000000-0000-4000-8000-00000000000f', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'C015', 'cable', 'active', '2024-01-01', true),
  ('a1000000-0000-4000-8000-000000000010', 'c1000000-0000-4000-8000-000000000010', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'I001', 'internet', 'active', '2024-01-01', true),
  ('a1000000-0000-4000-8000-000000000011', 'c1000000-0000-4000-8000-000000000011', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'I002', 'internet', 'active', '2024-01-01', true),
  ('a1000000-0000-4000-8000-000000000012', 'c1000000-0000-4000-8000-000000000012', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'I003', 'internet', 'active', '2024-01-01', true),
  ('a1000000-0000-4000-8000-000000000013', 'c1000000-0000-4000-8000-000000000013', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'I004', 'internet', 'active', '2024-01-01', true),
  ('a1000000-0000-4000-8000-000000000014', 'c1000000-0000-4000-8000-000000000014', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'I005', 'internet', 'active', '2024-01-01', true)
ON CONFLICT (id) DO NOTHING;

-- Billing Records (August 2025) - created_by set to NULL since employees don't exist yet
INSERT INTO billing_records (id, organization_id, customer_account_id, billing_month, bill_amount, previous_balance, discount, bill_date, due_date, status, metadata, created_by) VALUES
  ('b1000000-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'a1000000-0000-4000-8000-000000000001', '2025-08-01', 41800, -3600, 0, '2025-08-01', '2025-08-10', 'paid', '{"source_sheet": "August", "source_row": 10}'::jsonb, NULL),
  ('b1000000-0000-4000-8000-000000000002', '11111111-1111-1111-1111-111111111111', 'a1000000-0000-4000-8000-000000000002', '2025-08-01', 25500, -500, 0, '2025-08-01', '2025-08-10', 'paid', '{"source_sheet": "August", "source_row": 11}'::jsonb, NULL),
  ('b1000000-0000-4000-8000-000000000003', '11111111-1111-1111-1111-111111111111', 'a1000000-0000-4000-8000-000000000003', '2025-08-01', 38000, -3000, 0, '2025-08-01', '2025-08-10', 'paid', '{"source_sheet": "August", "source_row": 12}'::jsonb, NULL),
  ('b1000000-0000-4000-8000-000000000004', '11111111-1111-1111-1111-111111111111', 'a1000000-0000-4000-8000-000000000004', '2025-08-01', 40000, 0, 0, '2025-08-01', '2025-08-10', 'paid', '{"source_sheet": "August", "source_row": 13}'::jsonb, NULL),
  ('b1000000-0000-4000-8000-000000000005', '11111111-1111-1111-1111-111111111111', 'a1000000-0000-4000-8000-000000000005', '2025-08-01', 25000, 0, 0, '2025-08-01', '2025-08-10', 'paid', '{"source_sheet": "August", "source_row": 14}'::jsonb, NULL),
  ('b1000000-0000-4000-8000-000000000006', '11111111-1111-1111-1111-111111111111', 'a1000000-0000-4000-8000-000000000006', '2025-08-01', 60000, 0, 0, '2025-08-01', '2025-08-10', 'paid', '{"source_sheet": "August", "source_row": 16}'::jsonb, NULL),
  ('b1000000-0000-4000-8000-000000000007', '11111111-1111-1111-1111-111111111111', 'a1000000-0000-4000-8000-000000000010', '2025-08-01', 54000, 0, 0, '2025-08-01', '2025-08-10', 'paid', '{"source_sheet": "August", "source_row": 17}'::jsonb, NULL),
  ('b1000000-0000-4000-8000-000000000008', '11111111-1111-1111-1111-111111111111', 'a1000000-0000-4000-8000-000000000011', '2025-08-01', 105000, 0, 0, '2025-08-01', '2025-08-10', 'paid', '{"source_sheet": "August", "source_row": 18}'::jsonb, NULL)
ON CONFLICT (customer_account_id, billing_month) DO NOTHING;

-- Payment Transactions - employee_id set to NULL since employees don't exist yet
-- client_operation_id uses valid hex UUIDs (no 'o', 'p' prefixes)
INSERT INTO payment_transactions (id, organization_id, billing_record_id, customer_id, employee_id, transaction_date, amount_paid, payment_mode, location, collector_name, sub_collector, remarks, is_offline, sync_status, client_operation_id) VALUES
  ('d1000000-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'b1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', NULL, '2025-08-01', 45000, 'cash', 'home', 'Chandan', 'Chandan', null, false, 'synced', 'a1000000-0000-4000-8000-000000000001'),
  ('d1000000-0000-4000-8000-000000000002', '11111111-1111-1111-1111-111111111111', 'b1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000002', NULL, '2025-08-01', 25000, 'cash', 'home', 'Chandan', 'Chandan', null, false, 'synced', 'a2000000-0000-4000-8000-000000000002'),
  ('d1000000-0000-4000-8000-000000000003', '11111111-1111-1111-1111-111111111111', 'b1000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000003', NULL, '2025-08-01', 38000, 'cash', 'home', 'Chandan', 'Chandan', null, false, 'synced', 'a3000000-0000-4000-8000-000000000003'),
  ('d1000000-0000-4000-8000-000000000004', '11111111-1111-1111-1111-111111111111', 'b1000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000004', NULL, '2025-08-01', 40000, 'cash', 'home', 'Chandan', 'Chandan', null, false, 'synced', 'a4000000-0000-4000-8000-000000000004'),
  ('d1000000-0000-4000-8000-000000000005', '11111111-1111-1111-1111-111111111111', 'b1000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000005', NULL, '2025-08-01', 25000, 'cash', 'home', 'Chandan', 'Chandan', null, false, 'synced', 'a5000000-0000-4000-8000-000000000005'),
  ('d1000000-0000-4000-8000-000000000006', '11111111-1111-1111-1111-111111111111', 'b1000000-0000-4000-8000-000000000006', 'c1000000-0000-4000-8000-000000000006', NULL, '2025-08-01', 60000, 'gpay', 'home', 'Tarun', 'Office Time', null, false, 'synced', 'a6000000-0000-4000-8000-000000000006'),
  ('d1000000-0000-4000-8000-000000000007', '11111111-1111-1111-1111-111111111111', 'b1000000-0000-4000-8000-000000000007', 'c1000000-0000-4000-8000-000000000010', NULL, '2025-08-01', 54000, 'gpay', 'home', 'Tarun', 'Office Time', null, false, 'synced', 'a7000000-0000-4000-8000-000000000007'),
  ('d1000000-0000-4000-8000-000000000008', '11111111-1111-1111-1111-111111111111', 'b1000000-0000-4000-8000-000000000008', 'c1000000-0000-4000-8000-000000000011', NULL, '2025-08-01', 105000, 'gpay', 'home', 'Tarun', 'Office Time', null, false, 'synced', 'a8000000-0000-4000-8000-000000000008')
ON CONFLICT (client_operation_id) DO NOTHING;

-- Cashbook Entries - employee_id set to NULL since employees don't exist yet
-- client_operation_id uses valid hex UUIDs (8-4-4-4-12 format)
INSERT INTO cashbook_entries (id, organization_id, employee_id, entry_date, category, particulars, credit_amount, debit_amount, running_balance, remarks, is_system_generated, client_operation_id) VALUES
  ('e1000000-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', NULL, '2025-08-01', 'balance', 'Opening Balance', 0, 0, 59200, null, true, 'cc111111-1111-1111-1111-111111111111'),
  ('e1000000-0000-4000-8000-000000000002', '11111111-1111-1111-1111-111111111111', NULL, '2025-08-01', 'collection', 'Chandan Collection', 173000, 0, 232200, null, false, 'cc222222-2222-2222-2222-222222222222'),
  ('e1000000-0000-4000-8000-000000000003', '11111111-1111-1111-1111-111111111111', NULL, '2025-08-01', 'collection', 'Office Cash Collected', 0, 0, 232200, null, false, 'cc333333-3333-3333-3333-333333333333'),
  ('e1000000-0000-4000-8000-000000000004', '11111111-1111-1111-1111-111111111111', NULL, '2025-08-01', 'expense', 'Barun Da', 0, 2000, 230200, null, false, 'cc444444-4444-4444-4444-444444444444'),
  ('e1000000-0000-4000-8000-000000000005', '11111111-1111-1111-1111-111111111111', NULL, '2025-08-01', 'expense', 'Barun Da', 0, 1000, 229200, null, false, 'cc555555-5555-5555-5555-555555555555'),
  ('e1000000-0000-4000-8000-000000000006', '11111111-1111-1111-1111-111111111111', NULL, '2025-08-01', 'expense', 'Barun Da', 0, 5000, 224200, null, false, 'cc666666-6666-6666-6666-666666666666'),
  ('e1000000-0000-4000-8000-000000000007', '11111111-1111-1111-1111-111111111111', NULL, '2025-08-01', 'balance', 'Closing Balance', 0, 0, 224200, null, true, 'cc777777-7777-7777-7777-777777777777'),
  ('e1000000-0000-4000-8000-000000000008', '11111111-1111-1111-1111-111111111111', NULL, '2025-08-02', 'balance', 'Opening Balance', 0, 0, 224200, null, true, 'cc888888-8888-8888-8888-888888888888'),
  ('e1000000-0000-4000-8000-000000000009', '11111111-1111-1111-1111-111111111111', NULL, '2025-08-02', 'collection', 'Chandan Collection', 0, 0, 224200, null, false, 'cc999999-9999-9999-9999-999999999999'),
  ('e1000000-0000-4000-8000-00000000000a', '11111111-1111-1111-1111-111111111111', NULL, '2025-08-02', 'balance', 'Closing Balance', 0, 0, 224200, null, true, 'ccaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
ON CONFLICT (client_operation_id) DO NOTHING;

-- Daily Summary
INSERT INTO daily_summaries (id, organization_id, summary_date, opening_balance, collector_collection, income, expense, chandan_collection, cash_collection, deposit_return, deposit, commission, salary, advance) VALUES
  ('f1000000-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', '2025-08-01', 59200, 85000, 176000, 420000, 85000, 176000, 200000, 1650000, 0, 950000, 130000)
ON CONFLICT (organization_id, summary_date) DO NOTHING;