# Excel Workbook Analysis — August Worksheet (Primary Reference)

**Project:** CCN Business Management System  
**Date:** 2025-11-21  
**Phase:** 1 — Audit and Discovery  
**Source File:** `Bookkeeping.xlsx` — Sheet: **August**

---

## 1. Worksheet Structure Overview

The **August** worksheet (max_row=509, max_col=28) contains **three distinct sections** that share the same physical rows but are logically independent:

| Section | Columns | Purpose |
|---------|---------|---------|
| **Summary Section** | Rows 1-8, Cols C-D, W-AC | Monthly financial summaries |
| **Customer Collection Register** | Rows 9-508, Cols A-T | Daily customer payment collections |
| **Daily Cashbook** | Rows 9-508, Cols V-AC | Daily income/expense/balance tracking |

**Critical Rule:** Row alignment between Collection Register and Cashbook is coincidental. Do NOT join records by row number.

---

## 2. Section A: Customer Collection Register (Columns A-T)

### 2.1 Column Mapping

| Col | Letter | Field | Type | Source / Formula |
|-----|--------|-------|------|------------------|
| 1 | A | Date | Date | Manual entry |
| 2 | B | ID | Text/Number | Manual entry (portal Customer ID) |
| 3 | C | Name | Text | `=IFNA(INDEX('Combo Ref'!B$2:B$1000,MATCH(August!$B10,'Combo Ref'!$A$2:$A$1000,0)),"")` |
| 4 | D | Address | Text | `=IFNA(INDEX('Combo Ref'!D$2:D$1000,MATCH(August!$B10,'Combo Ref'!$A$2:$A$1000,0)),"")` |
| 5 | E | Mobile | Text | `=IFNA(INDEX('Combo Ref'!C$2:C$1000,MATCH(August!$B10,'Combo Ref'!$A$2:$A$1000,0)),"")` |
| 6 | F | P Bal | Number | Manual entry (Previous Balance) |
| 7 | G | Bill | Number | Manual entry (Current Bill Amount) |
| 8 | H | Discount | Number | Manual entry (optional) |
| 9 | I | Total | Number | `=G-F-H` (Bill - P Bal - Discount) |
| 10 | J | P date | Date | Manual entry (Previous Payment Date) |
| 11 | K | Paid | Number | Manual entry (Amount Paid) |
| 12 | L | Due | Number | `=K-I` (Paid - Total) |
| 13 | M | (Empty) | — | — |
| 14 | N | Location | Text | "Home" / "Office" |
| 15 | O | Mode | Text | "Cash" / "Gpay" |
| 16 | P | Done By | Text | Collector name ("Collector", "Chandan", "Rajib", "Tarun", "Choton") |
| 17 | Q | Home Coll. | Text | Sub-collector ("Chandan", "Office Time") |
| 18 | R | (Empty) | — | — |
| 19 | S | (Empty) | — | — |
| 20 | T | REMARKS | Text | Free text notes |

### 2.2 Key Formula Analysis

#### Total Calculation (Column I)
```
Total = Bill - P_Bal - Discount
```
**Example Row 10:** Bill=418, P_Bal=-36, Discount=0 → Total = 418 - (-36) - 0 = **454** ✅

#### Due Calculation (Column L)
```
Due = Paid - Total
```
**Example Row 10:** Paid=450, Total=454 → Due = 450 - 454 = **-4** ✅

**Sign Convention Investigation:**
- **P_Bal (Previous Balance):** Negative = Customer owes money (debit balance). Positive = Customer has credit (advance payment).
  - Row 10: P_Bal = -36 (customer owes ₹36 from previous month)
  - Row 19: P_Bal = +38 (customer has ₹38 credit)
- **Total:** Amount due this month after adjusting for previous balance and discount
  - If P_Bal negative: Total > Bill (customer owes more)
  - If P_Bal positive: Total < Bill (credit reduces current due)
- **Due:** Positive = Overpaid / Advance. Negative = Underpaid / Still owes.
  - Row 10: Due = -4 (customer paid ₹450 but owed ₹454 → still owes ₹4)
  - Row 22: Due = +8 (customer paid ₹400 but owed ₹392 → ₹8 advance)

**This is NOT standard accounting.** In standard accounting:
- Receivable = Bill + Previous_Due - Payment
- Positive = Customer owes us
- Here: Due = Paid - (Bill - Prev_Bal - Discount)

**Action Required:** Confirm this sign convention with user before implementing.

### 2.3 ID Field Characteristics
- **Not unique per row** — Same customer appears multiple times (e.g., ID 262 appears rows 12 & 15)
- **Mixed format:** Numeric (123, 132) and alphanumeric ('FCC036', 'rajusarkar', 'biki2022')
- **Leading zeros possible** — Stored as text in Excel
- **Not a transaction ID** — Multiple rows = multiple collection events for same customer

### 2.4 Collector / Done By Values Observed
| Value | Role |
|-------|------|
| Chandan | Primary field collector |
| Rajib | Office collector |
| Tarun | Owner/office |
| Collector | Generic (likely Chandan) |
| Choton | Assistant |

---

## 3. Section B: Daily Cashbook (Columns V-AC)

### 3.1 Column Mapping

| Col | Letter | Field | Type |
|-----|--------|-------|------|
| 22 | V | Date | Date |
| 23 | W | Category | Text (controlled vocabulary) |
| 24 | X | Particulars | Text (description) |
| 25 | Y | + (Credit) | Number |
| 26 | Z | - (Debit) | Number |
| 27 | AA | Balance | Number (running) |
| 28 | AB | Remarks | Text |

### 3.2 Categories (Controlled Vocabulary)

| Category | Type | Description |
|----------|------|-------------|
| **Balance** | System | Opening/Closing balance markers |
| **Collection** | Income | Chandan Collection, Office Cash Collected |
| **Advance** | Transfer | Chandan advance given/returned |
| **Deposit Return** | Transfer | Customer deposit returned |
| **Deposit** | Transfer | Customer deposit received |
| **Income** | Revenue | Barun Da income, misc income |
| **Expense** | Expense | Barun Da, Sarkar Garage, etc. |
| **Commission** | Expense | Commission paid |
| **Salary** | Expense | Employee salaries |

### 3.3 Running Balance Formula (Column AA)
```
AA10 = 592 (hardcoded opening balance for Aug 1)
AA11 = IF((Y11="")*(Z11=""),"", AA10 + (Y11 - Z11))
```
Running balance = Previous Balance + Credit - Debit

### 3.4 Key Observations
- **Opening Balance (Row 10, AA):** 592 — Carried from July closing
- **Closing Balance (Row 96, AA):** 480 — August 11 closing
- **Internal Transfers:** "Advance", "Deposit", "Deposit Return" are cash movements, NOT revenue/expense
- **Actual Revenue:** "Income" + "Collection" (but Collection includes Chandan/Office collections which may overlap with customer payments)
- **Actual Expenses:** "Expense" + "Commission" + "Salary"

---

## 4. Section C: Monthly Summary (Rows 1-8, Cols C-D & W-AC)

### 4.1 Summary Formulas

| Label | Cell | Formula / Value |
|-------|------|-----------------|
| **Collection** | D2 | `=SUMIF($W$10:$W$508,$W2,$Y$10:$Y$508)` = 26,818 |
| **Advance** | Z2 | `=SUMIF($W$10:$W$508,$Z2,$Z$10:$Z$508)` = 1,300 |
| **Opening Balance** | D3 | Array formula = 2,070 |
| **Deposit Return** | Y3 | `=SUMIF($W$10:$W$508,$W3,$Y$10:$Y$508)` = 2,000 |
| **Deposit** | Z3 | `=SUMIF($W$10:$W$508,$Z3,$Z$10:$Z$508)` = 16,500 |
| **Net Deposit** | AA3 | `=AA3-X3` (or similar) = 14,500 |
| **Collector Collection** | D4 | `=SUMIFS($K$10:$K$508,$A$10:$A$508,$D$1,$O$10:$O$508,"Cash",$N$10:$N$508,"Home",$P$10:$P$508,"Collector")` = 850 |
| **Chandan Collection** | G4 | (Manual?) = 850 |
| **Income** | D5 | Array formula = 1,760 |
| **Cash Collection** | G5 | (Linked to cashbook) |
| **Expense** | D6 | `=SUMIF($V$10:$V$508,$D$1,$Z$10:$Z$508)` = 4,200 |
| **Closing Balance** | D7 | `=SUM(D3:D5)-D6` = 480 |

### 4.2 Summary Relationships

```
Closing Balance = Opening Balance + Collector Collection + Income - Expense
480 = 2,070 + 850 + 1,760 - 4,200
480 = 480 ✅
```

**Cashbook Closing Balance (Row 96, AA)** = 480 → **Matches Summary Closing Balance**

---

## 5. Reference Worksheets

### 5.1 Combo Ref (651 rows × 6 cols)
**Primary customer master** — Used by VLOOKUP in monthly sheets
| Col | Field | Example |
|-----|-------|---------|
| A | LCOID | 100 |
| B | Name | Amal Sanyal |
| C | Mobile | 9832433875 |
| D | Address | BC Colony |
| E | (Empty) | |
| F | Display | "Amal Sanyal (100)" |

**Key:** LCOID = Portal Customer ID (matches Column B in monthly sheets)

### 5.2 Cable Ref (598 rows × 6 cols)
Cable TV customers with STB details
| Col | Field | Example |
|-----|-------|---------|
| A | LCOID | 100 |
| B | Name | Amal Sanyal |
| C | Mobile | 9832433875 |
| D | Address | BC Colony |
| E | Serial Number | 13FF00010FBB |
| F | VC Number | 8125504079444590 |

### 5.3 Internet Ref (53 rows × 11 cols)
Broadband customers (different ID format: FCCxxx, sg2021, etc.)
| Col | Field | Example |
|-----|-------|---------|
| A | Status | "System Disabled / OUT" |
| B | ID | FCC029 |
| C | Name | Prasenjit Das |
| D | Mobile | 9733387059 |
| E | Address | Dashrathpally |

---

## 6. Other Monthly Sheets (Same Structure)

All monthly sheets (Jan-Dec, Nov, Dec) follow identical structure:
- Same 3-section layout
- Same formulas
- Different data
- Summary dates in Row 1, Col D (e.g., `2026-08-14` for August)

### Monthly Summary Totals (Data Only)

| Month | Opening Bal | Collection | Income | Expense | Closing Bal |
|-------|-------------|------------|--------|---------|-------------|
| Jan 2026 | 4,008 | 54,286 | 700 | 33,130 | (calc) |
| Feb 2026 | 2,101 | 53,924 | 3,180 | 45,041 | |
| Mar 2026 | 1,600 | 52,078 | 1,550 | 40,449 | |
| Apr 2026 | 817 | 54,196 | 1,010 | 45,532 | |
| May 2026 | 628 | 52,139 | 0 | 40,560 | |
| Jun 2026 | 766 | 59,295 | 150 | 46,722 | |
| Jul 2026 | 4,483 | 47,613 | 749 | 6,357 | |
| Aug 2026 | 2,070 | 26,818 | 1,760 | 4,200 | 480 |
| Nov 2025 | 3,269 | 51,224 | 300 | 33,223 | |
| Dec 2025 | 3,252 | 56,858 | 1,200 | 35,055 | |

---

## 7. Proposed Database Entity Mapping

### 7.1 Core Entities

```
organizations
  - id (UUID PK)
  - name, code, gst_number, address
  - created_at, updated_at

employees
  - id (UUID PK)
  - organization_id (FK)
  - user_id (Supabase Auth FK)
  - name, role, phone, is_active
  - created_at

customers
  - id (UUID PK)
  - organization_id (FK)
  - portal_customer_id (Text, UNIQUE) -- "LCOID" from Combo Ref
  - name, mobile, address, location
  - cable_ref_id (FK, nullable) -- link to Cable Ref
  - internet_ref_id (FK, nullable) -- link to Internet Ref
  - status (active/inactive)
  - created_at, updated_at

customer_accounts
  - id (UUID PK)
  - customer_id (FK)
  - account_type (cable/internet/combo)
  - portal_account_number
  - service_plan_id (FK)
  - status, start_date, end_date

service_plans
  - id (UUID PK)
  - name, monthly_rate, description
  - is_active

billing_records
  - id (UUID PK)
  - customer_account_id (FK)
  - billing_month (Date, 1st of month)
  - bill_amount (Integer paise)
  - previous_balance (Integer paise, signed)
  - discount (Integer paise)
  - total_due (Integer paise, computed: bill - prev_bal - discount)
  - bill_date, due_date
  - created_at, created_by (FK employees)

payment_transactions
  - id (UUID PK)
  - billing_record_id (FK, nullable for advance payments)
  - customer_id (FK)
  - employee_id (FK) -- collector
  - transaction_date (Date)
  - amount_paid (Integer paise)
  - payment_mode (cash/gpay/upi/bank)
  - location (home/office)
  - collector_name (Text) -- "Chandan", "Rajib", etc.
  - sub_collector (Text, nullable)
  - remarks (Text)
  - due_after_payment (Integer paise, computed: paid - total_due)
  - is_offline (Boolean)
  - sync_status (pending/synced/conflict)
  - client_operation_id (UUID, idempotency key)
  - created_at, synced_at

cashbook_entries
  - id (UUID PK)
  - organization_id (FK)
  - employee_id (FK)
  - entry_date (Date)
  - category (Enum: balance/collection/advance/deposit_return/deposit/income/expense/commission/salary)
  - particulars (Text)
  - credit_amount (Integer paise) -- Y column (+)
  - debit_amount (Integer paise) -- Z column (-)
  - running_balance (Integer paise) -- AA column
  - remarks (Text)
  - is_system_generated (Boolean) -- for opening/closing balance rows
  - client_operation_id (UUID)
  - created_at, synced_at

daily_summaries
  - id (UUID PK)
  - organization_id (FK)
  - summary_date (Date, UNIQUE per org)
  - opening_balance (Integer paise)
  - collector_collection (Integer paise)
  - income (Integer paise)
  - expense (Integer paise)
  - closing_balance (Integer paise, computed)
  - chandan_collection (Integer paise)
  - cash_collection (Integer paise)
  - deposit_return (Integer paise)
  - deposit (Integer paise)
  - commission (Integer paise)
  - salary (Integer paise)
  - advance (Integer paise)
  - created_at, updated_at
```

### 7.2 Key Design Decisions

1. **Financial Values:** Store as **integer paise** (₹1 = 100 paise) to avoid floating-point errors
2. **Portal IDs:** Preserve original `portal_customer_id` as text, support alphanumeric (FCC036, rajusarkar)
3. **Idempotency:** Every offline-created record gets `client_operation_id` (UUID v4)
4. **Previous Balance:** Signed integer (negative = customer owes, positive = credit)
5. **Due Calculation:** `due = paid - total_due` (per Excel convention — confirm with user)
6. **Cashbook Independence:** `cashbook_entries` NOT linked to `payment_transactions` — they share dates but are separate registers

---

## 8. Critical Questions Requiring User Confirmation

### Q1: Due Calculation Sign Convention
**Current Excel:** `Due = Paid - Total` where `Total = Bill - P_Bal - Discount`
- Negative Due = Customer still owes money
- Positive Due = Customer overpaid (advance)

**Standard Accounting:** `Outstanding = Total - Paid`
- Positive = Customer owes
- Negative = Credit/Advance

**Question:** Should the app use Excel's convention (Due = Paid - Total) or standard accounting (Outstanding = Total - Paid)?

### Q2: Previous Balance (P_Bal) Meaning
**Observed:** Negative = Customer owes from previous month. Positive = Customer has credit.
**Question:** Is this correct? Should P_Bal be carried forward automatically from previous month's closing Due?

### Q3: Collection Register vs Cashbook "Collection"
**Observation:** Cashbook has "Chandan Collection" and "Office Cash Collected" categories. Collection Register has employee "Done By" = Chandan/Rajib.
**Question:** Are these the same money? Should Cashbook Collection entries be auto-generated from Collection Register?

### Q4: Deposit/Advance Handling
**Observation:** "Advance" (to Chandan), "Deposit" (from customer), "Deposit Return" (to customer) appear in Cashbook.
**Question:** Should these be separate from revenue/expense? Are they balance sheet items (liability/assets)?

### Q5: Monthly Sheet Independence
**Question:** Is each month a fresh start, or does Opening Balance carry from previous month's Closing Balance automatically?

### Q6: Internet vs Cable Customers
**Observation:** Combo Ref has ~650 customers. Cable Ref has ~598. Internet Ref has ~53 (different ID format).
**Question:** Should customers be unified? Can a customer have both cable and internet?

### Q7: Discount Handling
**Observation:** Column H (Discount) is mostly empty/NULL in August data.
**Question:** Is discount a regular feature? Per-customer or per-transaction?

---

## 9. Import Strategy for Historical Data

### 9.1 Import Order
1. **Combo Ref** → `customers` table (master)
2. **Cable Ref** → enrich `customers` with STB details
3. **Internet Ref** → enrich or create separate internet customers
4. **Monthly Sheets (Jan-Aug)** → `billing_records` + `payment_transactions` + `cashbook_entries` + `daily_summaries`

### 9.2 Validation Checks
- Row count match per sheet
- Formula totals match computed totals
- Customer ID resolution rate (>95% target)
- Running balance continuity across months
- Closing Balance = Next Month Opening Balance

### 9.3 Reconciliation Report
Generate report comparing:
- Total Billed (Excel vs DB)
- Total Collected (Excel vs DB)
- Total Discounts
- Customer-wise balances
- Cashbook Income/Expense
- Monthly Closing Balances

---

## 10. Risks & Open Issues

| Risk | Impact | Mitigation |
|------|--------|------------|
| Undocumented portal AJAX endpoints | Extension scraping breaks | Build API abstraction layer; monitor for changes |
| Excel sign convention non-standard | Financial reports wrong | Confirm with user; document clearly |
| Alphanumeric customer IDs | Schema complexity | Use TEXT type, preserve exactly |
| No unique transaction ID in Excel | Duplicate import risk | Use composite key (date + customer_id + row_num) |
| Cashbook/Collection overlap | Double-counting revenue | Separate entities; clear business rules |
| Single-user extension storage | Multi-employee conflict | Migrate to Supabase Auth + RLS |
| Free-tier Supabase limits | Scaling issues | Document limits; plan migration path |

---

## 11. Next Steps (Phase 2 Preparation)

1. **Get user confirmation** on Q1-Q7 above
2. **Design Supabase schema** with migrations
3. **Build import scripts** with validation
4. **Create seed data** for development
5. **Set up Supabase project** with RLS policies