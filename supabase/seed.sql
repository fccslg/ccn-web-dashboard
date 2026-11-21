-- CCN Business Management System - Development Seed Data
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