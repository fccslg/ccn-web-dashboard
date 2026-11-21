# System Architecture

**Project:** CCN Business Management System  
**Date:** 2025-11-21  
**Phase:** 1 — Audit and Discovery  
**Status:** Draft for Review

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CCN Business Management Platform                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                       │
│  │ Chrome Ext   │  │ Web Dashboard│  │ Android App  │                       │
│  │ (Portal +    │  │ (React/TS/   │  │ (React Native│                       │
│  │  Bookkeeping)│  │  Vite/Tailwind)          │                       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                       │
│         │                 │                 │                               │
│         └─────────────────┼─────────────────┘                               │
│                           ▼                                                 │
│              ┌────────────────────────┐                                     │
│              │   Supabase Backend     │                                     │
│              │  (PostgreSQL + Auth +  │                                     │
│              │   Realtime + Storage)  │                                     │
│              └────────────┬───────────┘                                     │
│                           │                                                 │
│              ┌────────────┴───────────┐                                     │
│              │  Offline Sync Engine   │                                     │
│              │  (IndexedDB / SQLite)  │                                     │
│              └────────────────────────┘                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Technology Stack

### 2.1 Core Technologies

| Layer | Technology | Version | Rationale |
|-------|------------|---------|-----------|
| **Database** | Supabase (PostgreSQL) | 15+ | Free tier, Auth, RLS, Realtime |
| **API** | Supabase Client + PostgREST | Latest | Auto-generated REST from schema |
| **Auth** | Supabase Auth | Latest | Email/password, RLS integration |
| **Web Frontend** | React 18 + TypeScript + Vite | Latest | Modern, fast, great DX |
| **Styling** | Tailwind CSS | 3.x | Utility-first, responsive |
| **State/Data** | TanStack Query (React Query) | 5.x | Server state, caching, offline |
| **Offline (Web)** | Dexie.js (IndexedDB wrapper) | 4.x | Type-safe IndexedDB |
| **Offline (Ext)** | chrome.storage + IndexedDB | Native | Extension storage + web DB |
| **Mobile** | React Native + Expo | Latest | Code sharing with web |
| **Mobile DB** | Expo SQLite / WatermelonDB | Latest | Offline-first sync |
| **Build** | Vite (web), EAS Build (mobile) | Latest | Fast, optimized |
| **Hosting** | Cloudflare Pages (web) | Free tier | Unlimited bandwidth, custom domains |
| **CI/CD** | GitHub Actions | Free | Automated testing/deploy |

### 2.2 Shared Packages (Monorepo)

```
packages/
├── shared/
│   ├── types/           # TypeScript types, Zod schemas
│   ├── validation/      # Business rule validation (billing, due calc)
│   ├── constants/       # Enums: payment_mode, category, role
│   ├── utils/           # Date, currency, ID formatting
│   └── api/             # Supabase client, API contracts
├── web/
│   └── (React app)
├── extension/
│   └── (Chrome extension - MV3)
└── mobile/
    └── (Expo React Native app)
```

---

## 3. Database Schema (Supabase PostgreSQL)

### 3.1 Core Tables

```sql
-- Organizations (multi-tenancy ready)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  gst_number TEXT,
  address JSONB,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Employees (linked to Supabase Auth)
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'collector', 'accountant', 'viewer')),
  phone TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- Customers (master from Combo Ref)
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  portal_customer_id TEXT NOT NULL, -- LCOID from portal (alphanumeric)
  name TEXT NOT NULL,
  mobile TEXT,
  address TEXT,
  location TEXT, -- BC Colony, Janata Nagar, etc.
  cable_ref_id TEXT, -- Serial from Cable Ref
  internet_ref_id TEXT, -- ID from Internet Ref (FCCxxx)
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, portal_customer_id)
);

-- Service Plans
CREATE TABLE service_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('cable', 'internet', 'combo')),
  monthly_rate INTEGER NOT NULL, -- paise
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customer Accounts (subscriptions)
CREATE TABLE customer_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  service_plan_id UUID REFERENCES service_plans(id),
  portal_account_number TEXT,
  account_type TEXT CHECK (account_type IN ('cable', 'internet', 'combo')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired', 'pending')),
  start_date DATE,
  end_date DATE,
  auto_renew BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Billing Records (monthly bills)
CREATE TABLE billing_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  customer_account_id UUID REFERENCES customer_accounts(id) ON DELETE CASCADE,
  billing_month DATE NOT NULL, -- 1st of month
  bill_amount INTEGER NOT NULL DEFAULT 0, -- paise
  previous_balance INTEGER NOT NULL DEFAULT 0, -- paise (signed: neg=owes, pos=credit)
  discount INTEGER NOT NULL DEFAULT 0, -- paise
  total_due INTEGER GENERATED ALWAYS AS (bill_amount - previous_balance - discount) STORED,
  bill_date DATE,
  due_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'overdue', 'cancelled')),
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_account_id, billing_month)
);

-- Payment Transactions (collections)
CREATE TABLE payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  billing_record_id UUID REFERENCES billing_records(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  transaction_date DATE NOT NULL,
  amount_paid INTEGER NOT NULL, -- paise
  payment_mode TEXT NOT NULL CHECK (payment_mode IN ('cash', 'gpay', 'upi', 'bank', 'card', 'other')),
  location TEXT CHECK (location IN ('home', 'office', 'field')),
  collector_name TEXT, -- "Chandan", "Rajib", etc.
  sub_collector TEXT, -- "Office Time", "Chandan", etc.
  remarks TEXT,
  due_after_payment INTEGER GENERATED ALWAYS AS (
    amount_paid - COALESCE((
      SELECT total_due FROM billing_records WHERE id = payment_transactions.billing_record_id
    ), 0)
  ) STORED,
  is_offline BOOLEAN DEFAULT FALSE,
  sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('pending', 'synced', 'conflict', 'failed')),
  client_operation_id UUID NOT NULL UNIQUE, -- idempotency key
  server_operation_id UUID, -- for conflict resolution
  created_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ
);

-- Cashbook Entries (daily cash flow)
CREATE TABLE cashbook_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  entry_date DATE NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'balance', 'collection', 'advance', 'deposit_return', 'deposit',
    'income', 'expense', 'commission', 'salary'
  )),
  particulars TEXT,
  credit_amount INTEGER NOT NULL DEFAULT 0, -- paise (Y column +)
  debit_amount INTEGER NOT NULL DEFAULT 0, -- paise (Z column -)
  running_balance INTEGER NOT NULL DEFAULT 0, -- paise (AA column)
  remarks TEXT,
  is_system_generated BOOLEAN DEFAULT FALSE, -- opening/closing balance rows
  client_operation_id UUID NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ
);

-- Daily Summaries (monthly sheet summaries)
CREATE TABLE daily_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  summary_date DATE NOT NULL,
  opening_balance INTEGER NOT NULL DEFAULT 0,
  collector_collection INTEGER NOT NULL DEFAULT 0,
  income INTEGER NOT NULL DEFAULT 0,
  expense INTEGER NOT NULL DEFAULT 0,
  closing_balance INTEGER GENERATED ALWAYS AS (
    opening_balance + collector_collection + income - expense
  ) STORED,
  chandan_collection INTEGER NOT NULL DEFAULT 0,
  cash_collection INTEGER NOT NULL DEFAULT 0,
  deposit_return INTEGER NOT NULL DEFAULT 0,
  deposit INTEGER NOT NULL DEFAULT 0,
  commission INTEGER NOT NULL DEFAULT 0,
  salary INTEGER NOT NULL DEFAULT 0,
  advance INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, summary_date)
);

-- Audit Logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  action TEXT NOT NULL CHECK (action IN ('insert', 'update', 'delete', 'sync')),
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sync Operations (for offline sync tracking)
CREATE TABLE sync_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('pull', 'push', 'full')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'partial')),
  records_processed INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  error_details JSONB,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Import Batches (for Excel migration tracking)
CREATE TABLE import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  source_file TEXT NOT NULL,
  sheet_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'rolled_back')),
  total_rows INTEGER DEFAULT 0,
  imported_rows INTEGER DEFAULT 0,
  failed_rows INTEGER DEFAULT 0,
  validation_errors JSONB,
  reconciliation_report JSONB,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  rolled_back_at TIMESTAMPTZ
);
```

### 3.2 Row Level Security (RLS) Policies

```sql
-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashbook_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their organization's data
CREATE POLICY "org_isolation" ON organizations
  USING (id = (SELECT organization_id FROM employees WHERE user_id = auth.uid()));

-- Apply same pattern to all tables via helper function
CREATE OR REPLACE FUNCTION current_org_id() RETURNS UUID AS $$
  SELECT organization_id FROM employees WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Example policy for customers
CREATE POLICY "customer_org_isolation" ON customers
  USING (organization_id = current_org_id());

-- Repeat for all data tables...
```

### 3.3 Indexes for Performance

```sql
-- Critical query patterns
CREATE INDEX idx_customers_portal_id ON customers(organization_id, portal_customer_id);
CREATE INDEX idx_billing_month ON billing_records(organization_id, billing_month);
CREATE INDEX idx_billing_customer ON billing_records(customer_account_id, billing_month);
CREATE INDEX idx_payments_date ON payment_transactions(organization_id, transaction_date);
CREATE INDEX idx_payments_customer ON payment_transactions(customer_id, transaction_date);
CREATE INDEX idx_payments_employee ON payment_transactions(employee_id, transaction_date);
CREATE INDEX idx_payments_sync ON payment_transactions(sync_status, created_at);
CREATE INDEX idx_cashbook_date ON cashbook_entries(organization_id, entry_date);
CREATE INDEX idx_summaries_date ON daily_summaries(organization_id, summary_date);
```

---

## 4. Offline-First Architecture

### 4.1 Sync Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                    OFFLINE SYNC FLOW                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  LOCAL (IndexedDB/SQLite)          SERVER (Supabase)           │
│  ┌─────────────────────┐           ┌─────────────────────┐     │
│  │ Write Operations    │           │                     │     │
│  │ 1. Write to local DB│           │                     │     │
│  │ 2. Queue in outbox  │◄─────────►│ 3. Push to server   │     │
│  │    (idempotent)     │  SYNC     │    (upsert by       │     │
│  │                     │           │     client_op_id)   │     │
│  └─────────────────────┘           └─────────────────────┘     │
│         │                                    │                 │
│         │ 4. Pull changes                    │                 │
│         │    (since last sync)               │                 │
│         ▼                                    ▼                 │
│  ┌─────────────────────┐           ┌─────────────────────┐     │
│  │ Conflict Resolution │           │                     │     │
│  │ - Server wins for   │           │                     │     │
│  │   financial records │           │                     │     │
│  │ - Manual review for │           │                     │     │
│  │   conflicts         │           │                     │     │
│  └─────────────────────┘           └─────────────────────┘     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Idempotency Keys

Every offline mutation generates a `client_operation_id` (UUID v4):
- Used as **upsert key** on server
- Prevents duplicate application on retry
- Stored in local outbox table with status

### 4.3 Conflict Resolution Rules

| Entity | Conflict Strategy |
|--------|-------------------|
| `payment_transactions` | **Server wins** — financial integrity critical. Flag for manual review if amounts differ. |
| `cashbook_entries` | **Server wins** — running balance must be authoritative. |
| `customers` | **Merge** — last-write-wins per field, flag if name/mobile changed. |
| `billing_records` | **Server wins** — billing is authoritative. |
| `daily_summaries` | **Recalculate** — derived from transactions, not synced directly. |

### 4.4 Local Storage Schema (Dexie.js / IndexedDB)

```typescript
// packages/shared/types/offline.ts
interface OfflineDB {
  // Outbox for pending mutations
  outbox: {
    id: string;           // client_operation_id
    table: string;        // target table
    operation: 'insert' | 'update' | 'delete';
    data: Record<string, any>;
    created_at: number;   // timestamp
    retries: number;
    status: 'pending' | 'syncing' | 'failed' | 'synced';
  }[];
  
  // Cached reference data (read-heavy)
  customers: Customer[];
  service_plans: ServicePlan[];
  billing_records: BillingRecord[];
  
  // Pending user transactions
  payment_transactions: PaymentTransaction[];
  cashbook_entries: CashbookEntry[];
  
  // Sync metadata
  sync_metadata: {
    key: string;          // 'last_sync', 'last_pull_cursor'
    value: string;
    updated_at: number;
  }[];
}
```

---

## 5. Chrome Extension Integration

### 5.1 Architecture

```
Extension (MV3)
├── background.js (Service Worker)
│   ├── Auth state management
│   ├── Sync queue processor
│   ├── Portal API interception
│   └── Message routing
├── content.js
│   ├── Portal DOM enhancement
│   ├── Customer ID extraction
│   ├── Bookkeeping sidepanel injection
│   └── Quick actions (collect, view dues)
├── popup.html/js
│   ├── Dashboard summary
│   ├── Quick collection entry
│   ├── Sync status
│   └── Settings
├── sidepanel.html (NEW)
│   ├── Full bookkeeping UI
│   ├── Customer search
│   ├── Collection form
│   └── Cashbook entry
└── offscreen.html (for heavy compute)
    ├── OCR processing
    └── Large data sync
```

### 5.2 Portal Integration Points

| Portal Page | Extension Action | Bookkeeping Feature |
|-------------|------------------|---------------------|
| Login | Auto-fill, captcha solve | — |
| Customer List | Extract customer IDs | Quick search, jump to record |
| Customer Detail | Capture portal_customer_id | Open bookkeeping sidepanel |
| Collection/Receipt | Detect payment entry | Auto-fill collection form |
| Dashboard | Scrape stats | Sync to cloud |

### 5.3 Data Flow: Portal → Bookkeeping

```
1. User opens customer in portal
2. Content script extracts portal_customer_id from URL/DOM
3. Message to background: {type: 'CUSTOMER_CONTEXT', customerId}
4. Background queries local IndexedDB for customer record
5. Sidepanel opens with pre-filled customer data
6. User enters collection → saved locally → queued for sync
7. Background syncs when online
```

---

## 6. Web Dashboard Architecture

### 6.1 Route Structure

```
/ (Dashboard)
├── /customers
│   ├── /customers/:id (Profile)
│   ├── /customers/:id/collections
│   └── /customers/:id/dues
├── /bookkeeping
│   ├── /bookkeeping/collections (Daily entry)
│   ├── /bookkeeping/cashbook
│   ├── /bookkeeping/expenses
│   └── /bookkeeping/reconciliation
├── /reports
│   ├── /reports/daily
│   ├── /reports/monthly
│   ├── /reports/collector
│   └── /reports/outstanding
├── /settings
│   ├── /settings/employees
│   ├── /settings/plans
│   ├── /settings/categories
│   └── /settings/sync
└── /import (Admin only)
```

### 6.2 Component Architecture

```
src/
├── components/
│   ├── ui/              # Reusable: Button, Input, Table, Modal, Select
│   ├── forms/           # CollectionForm, CashbookForm, ExpenseForm
│   ├── tables/          # DataTable, VirtualizedTable
│   └── charts/          # DashboardCharts, TrendChart
├── features/
│   ├── customers/       # CustomerList, CustomerProfile, CustomerSearch
│   ├── bookkeeping/     # CollectionEntry, Cashbook, DailySummary
│   ├── reports/         # ReportBuilder, ExportExcel
│   └── sync/            # SyncStatus, ConflictResolver
├── hooks/
│   ├── useCustomers.ts
│   ├── useCollections.ts
│   ├── useCashbook.ts
│   ├── useOfflineSync.ts
│   └── useAuth.ts
├── lib/
│   ├── supabase.ts      # Client singleton
│   ├── validation.ts    # Zod schemas
│   ├── calculations.ts  # Billing, due, balance logic
│   └── formatters.ts    # INR, dates, phone
├── pages/
└── routes/
```

### 6.3 State Management

- **Server State:** TanStack Query (caching, invalidation, optimistic updates)
- **Client State:** React Context + useReducer (UI state, filters, forms)
- **Offline State:** Dexie.js (IndexedDB) + custom sync hook
- **Auth State:** Supabase Auth listener + React Context

---

## 7. Android Application Architecture

### 7.1 Expo + React Native Structure

```
mobile/
├── app/                    # Expo Router (file-based routing)
│   ├── (tabs)/
│   │   ├── index.tsx       # Dashboard
│   │   ├── customers.tsx
│   │   ├── collections.tsx
│   │   ├── cashbook.tsx
│   │   └── more.tsx
│   ├── customer/[id].tsx
│   ├── collection/new.tsx
│   └── _layout.tsx
├── components/
│   ├── ui/                 # Shared with web where possible
│   └── forms/
├── hooks/
│   ├── useOfflineDB.ts     # WatermelonDB / Expo SQLite
│   ├── useSync.ts
│   └── useAuth.ts
├── lib/
│   ├── database.ts         # WatermelonDB schema
│   ├── sync.ts             # Sync adapter
│   └── validators.ts
└── widgets/                # Home screen widget (native)
    ├── WidgetProvider.tsx
    └── widget.ts
```

### 7.2 Home Screen Widget (Native Android)

**Requires:** Expo Development Build (NOT Expo Go)

```
android/
├── app/src/main/
│   ├── java/com/ccn/bookkeeping/
│   │   ├── BookkeepingWidget.kt       # Glance/AppWidget provider
│   │   ├── WidgetUpdateService.kt     # Periodic updates
│   │   └── WidgetDataRepository.kt    # Shared preferences / DataStore
│   └── res/xml/
│       └── widget_info.xml
```

**Widget Data Source:** Local DataStore updated by main app on sync completion.

**Widget Features:**
1. Pending dues count + amount
2. Upcoming renewals (next 7 days)
3. Today's collections
4. Active customer count
5. Last sync timestamp
6. Tap search → opens app search

---

## 8. API Contracts (Shared Types)

### 8.1 Core Types (packages/shared/types)

```typescript
// packages/shared/types/index.ts

export type PaymentMode = 'cash' | 'gpay' | 'upi' | 'bank' | 'card' | 'other';
export type CollectionLocation = 'home' | 'office' | 'field';
export type CustomerStatus = 'active' | 'inactive' | 'suspended';
export type BillingStatus = 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled';
export type CashbookCategory = 
  | 'balance' | 'collection' | 'advance' 
  | 'deposit_return' | 'deposit' 
  | 'income' | 'expense' | 'commission' | 'salary';
export type EmployeeRole = 'owner' | 'admin' | 'collector' | 'accountant' | 'viewer';
export type SyncStatus = 'pending' | 'synced' | 'conflict' | 'failed';

// Financial: ALWAYS in paise (integer)
export type Paise = number & { readonly _brand: unique symbol };

export function toPaise(rupees: number): Paise {
  return Math.round(rupees * 100) as Paise;
}

export function toRupees(paise: Paise): number {
  return paise / 100;
}

// Customer
export interface Customer {
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
  created_at: string;
  updated_at: string;
}

// Billing Record
export interface BillingRecord {
  id: string;
  customer_account_id: string;
  billing_month: string; // YYYY-MM-DD (1st of month)
  bill_amount: Paise;
  previous_balance: Paise; // signed
  discount: Paise;
  total_due: Paise; // computed: bill - prev_bal - discount
  bill_date: string | null;
  due_date: string | null;
  status: BillingStatus;
  created_by: string | null;
  created_at: string;
}

// Payment Transaction
export interface PaymentTransaction {
  id: string;
  billing_record_id: string | null;
  customer_id: string;
  employee_id: string | null;
  transaction_date: string; // YYYY-MM-DD
  amount_paid: Paise;
  payment_mode: PaymentMode;
  location: CollectionLocation | null;
  collector_name: string | null;
  sub_collector: string | null;
  remarks: string | null;
  due_after_payment: Paise; // computed: paid - total_due
  is_offline: boolean;
  sync_status: SyncStatus;
  client_operation_id: string;
  created_at: string;
  synced_at: string | null;
}

// Cashbook Entry
export interface CashbookEntry {
  id: string;
  employee_id: string | null;
  entry_date: string;
  category: CashbookCategory;
  particulars: string | null;
  credit_amount: Paise;
  debit_amount: Paise;
  running_balance: Paise;
  remarks: string | null;
  is_system_generated: boolean;
  client_operation_id: string;
  created_at: string;
}

// Daily Summary
export interface DailySummary {
  id: string;
  summary_date: string;
  opening_balance: Paise;
  collector_collection: Paise;
  income: Paise;
  expense: Paise;
  closing_balance: Paise;
  chandan_collection: Paise;
  cash_collection: Paise;
  deposit_return: Paise;
  deposit: Paise;
  commission: Paise;
  salary: Paise;
  advance: Paise;
}
```

### 8.2 Validation Schemas (Zod)

```typescript
// packages/shared/validation/schemas.ts
import { z } from 'zod';

export const CollectionFormSchema = z.object({
  customer_id: z.string().uuid(),
  transaction_date: z.string().date(),
  amount_paid: z.number().int().positive(),
  payment_mode: PaymentModeEnum,
  location: LocationEnum,
  collector_name: z.string().min(1),
  sub_collector: z.string().optional(),
  remarks: z.string().optional(),
  billing_record_id: z.string().uuid().optional(),
});

export const CashbookFormSchema = z.object({
  entry_date: z.string().date(),
  category: CashbookCategoryEnum,
  particulars: z.string().min(1),
  credit_amount: z.number().int().nonnegative().optional(),
  debit_amount: z.number().int().nonnegative().optional(),
  remarks: z.string().optional(),
}).refine(
  (data) => data.credit_amount > 0 || data.debit_amount > 0,
  { message: 'Either credit or debit amount must be positive', path: ['credit_amount'] }
);
```

---

## 9. Security Architecture

### 9.1 Authentication & Authorization

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION FLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User → Supabase Auth (Email/Password)                          │
│    │                                                            │
│    ├── JWT Access Token (1hr) → Client                          │
│    ├── Refresh Token → Secure HTTP-only cookie                  │
│    └── User metadata → {organization_id, role}                  │
│                                                                  │
│  RLS Policies enforce:                                          │
│  - Organization isolation (all tables)                          │
│  - Role-based permissions (employees table)                     │
│  - Owner/Admin: full access                                     │
│  - Collector: own collections + assigned customers              │
│  - Accountant: read all, write cashbook/expenses                │
│  - Viewer: read only                                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 Data Protection

| Layer | Protection |
|-------|------------|
| **Transport** | HTTPS everywhere (Supabase, Cloudflare, Expo) |
| **At Rest** | Supabase encrypted storage, Android Keystore / iOS Keychain |
| **Local (Web)** | IndexedDB — no encryption (browser sandbox), session timeout |
| **Local (Mobile)** | Expo SecureStore for tokens, SQLite encrypted (SQLCipher) |
| **Local (Ext)** | chrome.storage.local (encrypted by Chrome), session lock |
| **Secrets** | Never in code — `.env` only, `.env.example` committed |

### 9.3 Audit Trail

All financial mutations logged to `audit_logs` with:
- Who (employee_id)
- What (table, record_id, action)
- Before/After values (JSONB)
- When (timestamp)
- Context (IP, user agent)

---

## 10. Deployment Architecture

### 10.1 Environments

| Environment | Purpose | URL | Database |
|-------------|---------|-----|----------|
| **Local** | Development | `localhost:5173` | Local Supabase (Docker) |
| **Preview** | PR testing | `preview-xxx.pages.dev` | Supabase Preview Branch |
| **Staging** | QA | `staging.ccn-bookkeeping.com` | Supabase Staging Project |
| **Production** | Live | `app.ccn-bookkeeping.com` | Supabase Production Project |

### 10.2 Free Tier Limits (Verified 2025)

| Service | Free Tier Limits | Notes |
|---------|-----------------|-------|
| **Supabase** | 500MB DB, 1GB file storage, 50K MAU, 2GB bandwidth | Pauses after 7 days inactivity |
| **Cloudflare Pages** | Unlimited sites, requests, bandwidth | 500 builds/month |
| **GitHub Actions** | 2000 min/month (private) | Enough for CI |
| **Expo (EAS Build)** | 30 builds/month | Dev builds for widget testing |
| **Total Monthly Cost** | **$0** | Within free tiers |

### 10.3 Backup Strategy

```bash
# Automated daily backup (GitHub Actions + Supabase CLI)
supabase db dump --schema public --data-only=false > backup_schema.sql
supabase db dump --schema public --data-only=true > backup_data.sql
# Upload to Cloudflare R2 / Google Drive / S3 (free tier)
```

---

## 11. Project Structure (Monorepo)

```
ccn-business-management/
├── .github/
│   └── workflows/           # CI/CD pipelines
├── docs/                    # All documentation
│   ├── ARCHITECTURE.md
│   ├── DATABASE_SCHEMA.md
│   ├── EXCEL_ANALYSIS.md
│   ├── EXTENSION_AUDIT.md
│   ├── OFFLINE_SYNC.md
│   └── ...
├── packages/
│   ├── shared/              # Shared types, validation, utils
│   │   ├── src/
│   │   │   ├── types/
│   │   │   ├── validation/
│   │   │   ├── constants/
│   │   │   ├── utils/
│   │   │   └── api/
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── web/                 # React + Vite + Tailwind
│   │   ├── src/
│   │   ├── public/
│   │   ├── index.html
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   └── tailwind.config.js
│   ├── extension/           # Chrome Extension MV3
│   │   ├── src/
│   │   │   ├── background/
│   │   │   ├── content/
│   │   │   ├── popup/
│   │   │   ├── sidepanel/
│   │   │   ├── offscreen/
│   │   │   └── shared/
│   │   ├── public/
│   │   │   └── manifest.json
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vite.config.ts
│   └── mobile/              # Expo React Native
│       ├── app/
│       ├── components/
│       ├── hooks/
│       ├── lib/
│       ├── widgets/         # Native Android widget
│       ├── android/         # Native widget code
│       ├── package.json
│       ├── tsconfig.json
│       ├── app.json
│       └── eas.json
├── supabase/                # Supabase local development
│   ├── migrations/
│   ├── seed.sql
│   └── config.toml
├── scripts/                 # Import, migration, utility scripts
│   ├── import-excel.ts
│   ├── reconcile.ts
│   └── backup.ts
├── turbo.json               # Turborepo config
├── package.json             # Root workspace
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── README.md
```

---

## 12. Development Workflow

### 12.1 Git Strategy

```
main ────────────────────────────────────────────►
  │
  ├── feature/ext-bookkeeping-integration
  ├── feature/web-dashboard-mvp
  ├── feature/mobile-app
  ├── feature/offline-sync
  └── hotfix/...
```

### 12.2 Commit Convention

```
type(scope): description

feat(web): add collection entry form
fix(ext): handle portal login redirect
refactor(shared): unify due calculation logic
test(shared): add billing calculation tests
docs: update EXCEL_ANALYSIS with sign convention
chore(deps): update supabase-js to v2
```

### 12.3 CI Pipeline

```yaml
# .github/workflows/ci.yml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps: [checkout, setup-node, pnpm install, pnpm lint]
  
  typecheck:
    runs-on: ubuntu-latest
    steps: [checkout, setup-node, pnpm install, pnpm typecheck]
  
  test:
    runs-on: ubuntu-latest
    services: [postgres]
    steps: [checkout, setup-node, pnpm install, pnpm test]
  
  build-web:
    needs: [lint, typecheck, test]
    runs-on: ubuntu-latest
    steps: [checkout, setup-node, pnpm install, pnpm build:web]
  
  build-extension:
    needs: [lint, typecheck]
    runs-on: ubuntu-latest
    steps: [checkout, setup-node, pnpm install, pnpm build:extension]
  
  build-mobile:
    needs: [lint, typecheck]
    runs-on: ubuntu-latest
    steps: [checkout, setup-node, pnpm install, pnpm build:mobile]
```

---

## 13. Risk Assessment & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Portal AJAX endpoints change | High | High | Abstract behind adapter; monitor; fallback to manual entry |
| Excel sign convention misunderstood | Medium | High | **Confirm with user before Phase 2** |
| Supabase free tier limits hit | Medium | Medium | Monitor usage; archive old data; plan paid tier |
| Offline sync conflicts | Medium | High | Idempotency keys; server-wins for financial; manual review queue |
| Android widget not in Expo Go | High | Medium | Use EAS Dev Build; document limitation |
| Customer ID mismatch (portal vs Excel) | High | High | Fuzzy matching + manual review queue; 95% auto-match target |
| Duplicate payment recording | Low | Critical | Client operation IDs + DB unique constraint + idempotent upsert |
| Data loss on device | Low | High | Daily cloud sync; encrypted local backup; export function |

---

## 14. Approval Checklist for Phase 2

Before proceeding to Phase 2 (Database Foundation), the following must be confirmed:

- [ ] **Q1:** Due calculation sign convention (Excel vs Standard)
- [ ] **Q2:** Previous balance carry-forward logic
- [ ] **Q3:** Collection Register ↔ Cashbook Collection relationship
- [ ] **Q4:** Deposit/Advance as balance sheet vs P&L items
- [ ] **Q5:** Monthly opening balance automation
- [ ] **Q6:** Cable + Internet customer unification
- [ ] **Q7:** Discount feature scope
- [ ] Supabase project created and configured
- [ ] Repository initialized with monorepo structure
- [ ] CI/CD pipeline configured
- [ ] Development environment documented

---

*End of Architecture Document*