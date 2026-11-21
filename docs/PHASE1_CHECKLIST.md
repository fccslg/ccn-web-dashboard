# Phase 1 Implementation Checklist

**Project:** CCN Business Management System  
**Date:** 2025-11-21  
**Status:** In Progress — Awaiting User Confirmation on Critical Questions

---

## ✅ Completed Audit Tasks

| Task | Status | Output |
|------|--------|--------|
| Chrome Extension source code analysis | ✅ Done | `docs/EXTENSION_AUDIT.md` |
| Excel August worksheet deep analysis | ✅ Done | `docs/EXCEL_ANALYSIS.md` |
| Reference sheets (Combo/Cable/Internet Ref) analysis | ✅ Done | `docs/EXCEL_ANALYSIS.md` |
| Other monthly sheets structure verification | ✅ Done | `docs/EXCEL_ANALYSIS.md` |
| Formula and business rule documentation | ✅ Done | `docs/EXCEL_ANALYSIS.md` |
| Proposed database schema design | ✅ Done | `docs/ARCHITECTURE.md` |
| Offline-first architecture design | ✅ Done | `docs/ARCHITECTURE.md` |
| Chrome extension integration design | ✅ Done | `docs/ARCHITECTURE.md` |
| Web dashboard architecture | ✅ Done | `docs/ARCHITECTURE.md` |
| Android app architecture | ✅ Done | `docs/ARCHITECTURE.md` |
| Security architecture | ✅ Done | `docs/ARCHITECTURE.md` |
| Deployment architecture | ✅ Done | `docs/ARCHITECTURE.md` |
| Project structure (monorepo) design | ✅ Done | `docs/ARCHITECTURE.md` |

---

## 🔴 Critical Questions Requiring User Confirmation

**Must be resolved before Phase 2 begins.**

### Q1: Due Calculation Sign Convention
**Excel Formula:** `Due = Paid - Total` where `Total = Bill - P_Bal - Discount`
- Negative Due = Customer still owes (underpaid)
- Positive Due = Customer overpaid (advance)

**Standard Accounting:** `Outstanding = Total - Paid`
- Positive = Customer owes
- Negative = Credit/Advance

**Options:**
- [ ] **Option A:** Keep Excel convention (Due = Paid - Total) — matches existing reports
- [ ] **Option B:** Use standard accounting (Outstanding = Total - Paid) — more intuitive
- [ ] **Option C:** Store both — Excel Due for compatibility, Standard Outstanding for new reports

**Recommendation:** Option C — store Excel `due` as `due_excel` and computed `outstanding` as `outstanding_standard` for clarity.

---

### Q2: Previous Balance (P_Bal) Carry-Forward Logic
**Observed:** 
- P_Bal negative = customer owes from previous month
- P_Bal positive = customer has credit/advance
- P_Bal manually entered each row (not auto-calculated in Excel)

**Question:** Should the app auto-calculate P_Bal from previous month's closing Due/Outstanding?
- [ ] **Yes, auto-calculate** — P_Bal = previous month's closing Due (with sign convention per Q1)
- [ ] **No, manual entry** — Keep as user-editable field for flexibility
- [ ] **Hybrid** — Auto-suggest but allow override

**Recommendation:** Hybrid — compute suggested P_Bal from last payment's `due_after_payment`, allow manual override with audit trail.

---

### Q3: Collection Register ↔ Cashbook "Collection" Relationship
**Observed in Cashbook (Category = Collection):**
- "Chandan Collection" — matches collector "Chandan" in register
- "Office Cash Collected" — matches location "Office" + collector "Rajib/Choton"

**Question:** Are these the SAME money recorded twice (once in register, once in cashbook)?
- [ ] **Yes, duplicate** — Cashbook Collection should be AUTO-GENERATED from register entries
- [ ] **No, separate** — Cashbook tracks physical cash movement; Register tracks customer liability
- [ ] **Partial overlap** — Some register payments go to cashbook, others (Gpay) don't

**Recommendation:** Partial overlap — Cashbook "Collection" = physical cash collected (Mode = Cash). Gpay/Online payments go to bank, not cashbook. Auto-generate cashbook entries for Cash mode payments.

---

### Q4: Deposit / Advance / Deposit Return Classification
**Cashbook Categories:**
- **Advance** — Money given to Chandan (field collector) as float
- **Deposit** — Security deposit received FROM customer
- **Deposit Return** — Security deposit returned TO customer

**Question:** Are these Balance Sheet items (Liability/Asset) or P&L?
- [ ] **Balance Sheet** — Deposit = Liability; Advance = Asset (receivable from Chandan)
- [ ] **P&L** — Treat as income/expense (current Excel behavior mixes them)
- [ ] **Separate tracking** — Track in cashbook but exclude from Income/Expense reports

**Recommendation:** Balance Sheet — Track separately, exclude from revenue/expense. Cashbook shows cash flow; P&L shows business performance.

---

### Q5: Monthly Opening Balance Automation
**Observed:** Opening Balance manually entered in Row 3 (D3) each month.
- Jan Opening = 4008
- Feb Opening = 2101 (≠ Jan Closing)
- Mar Opening = 1600
- Aug Opening = 2070

**Question:** Should Opening Balance be auto-carried from previous month Closing Balance?
- [ ] **Yes, strict carry-forward** — Opening = Previous Closing (enforce reconciliation)
- [ ] **No, manual** — Business may adjust (bank deposits, cash in hand differences)
- [ ] **Auto-suggest with override** — Pre-fill from previous closing, allow edit with reason

**Recommendation:** Auto-suggest with override — Pre-fill, require "Adjustment Reason" if changed.

---

### Q6: Cable + Internet Customer Unification
**Data:**
- Combo Ref: 650 customers (LCOID numeric: 100, 101...)
- Cable Ref: 598 customers (same LCOIDs + STB details)
- Internet Ref: 53 customers (different IDs: FCC036, rajusarkar, sg2021)

**Question:** Can one customer have both Cable and Internet?
- [ ] **Unified Customer** — One customer record, multiple service accounts
- [ ] **Separate** — Cable and Internet are different customer bases
- [ ] **Linkable** — Separate records but can be linked manually

**Evidence:** Some names appear in both (e.g., "Chandan" appears as collector and in Internet Ref as FCC029). IDs don't overlap.

**Recommendation:** Unified Customer with multiple `customer_accounts` (cable/internet/combo). Link via name+mobile fuzzy match during import, flag for review.

---

### Q7: Discount Feature Scope
**Observed:** Column H (Discount) mostly NULL/empty in August data.

**Question:** Is discount a regular business feature?
- [ ] **Per-transaction** — Discount on specific payment (current Excel column)
- [ ] **Per-bill** — Discount on monthly bill amount
- [ ] **Per-customer** — Standing discount rate
- [ ] **Not used** — Remove from schema

**Recommendation:** Per-bill discount (on `billing_records`). Keep per-transmission override capability.

---

## 📋 Phase 2 Readiness Checklist

### Database Foundation Prerequisites
- [ ] All 7 critical questions answered
- [ ] Supabase project created
- [ ] Database migrations written (from ARCHITECTURE.md schema)
- [ ] RLS policies defined and tested
- [ ] Seed data for development (organizations, employees, service_plans, categories)
- [ ] Local Supabase running (Docker) for development

### Repository Setup
- [ ] Monorepo initialized (pnpm + Turborepo)
- [ ] `packages/shared` published locally
- [ ] `packages/web` (Vite + React + TS + Tailwind) scaffolded
- [ ] `packages/extension` (Vite + MV3) scaffolded
- [ ] `packages/mobile` (Expo + TS) scaffolded
- [ ] CI/CD pipeline configured (GitHub Actions)
- [ ] ESLint + Prettier + TypeScript strict mode configured
- [ ] Husky pre-commit hooks

### Documentation
- [ ] `docs/DATABASE_SCHEMA.md` finalized
- [ ] `docs/API_DOCUMENTATION.md` started
- [ ] `docs/OFFLINE_SYNC.md` detailed
- [ ] `docs/SECURITY.md` written
- [ ] `docs/MIGRATION_PLAN.md` with import strategy

---

## 🚀 Phase 2 Tasks (Database Foundation)

Once critical questions resolved:

| Task | Estimate | Dependencies |
|------|----------|--------------|
| Create Supabase project & configure | 2h | Q1-Q7 answered |
| Write migration files (15+ tables) | 4h | Schema approved |
| Implement RLS policies | 3h | Role definitions final |
| Seed development data | 2h | Service plans, categories defined |
| Build import script skeleton | 4h | Excel analysis complete |
| Set up local Supabase (Docker) | 1h | - |
| Write database tests (pgTAP or Jest) | 4h | Schema stable |
| Document API contracts (PostgREST) | 2h | Types finalized |

**Total Phase 2 Estimate: ~22 hours**

---

## 📦 Phase 3 Preview (Bookkeeping MVP)

| Module | Key Features |
|--------|--------------|
| Customer Management | Search, profile, accounts, history |
| Billing Records | Monthly bill generation, P_Bal carry-forward |
| Collection Entry | Date, customer, amount, mode, collector, location |
| Due Calculation | Per Q1 decision, running balance per customer |
| Cashbook | Daily entry, categories, running balance |
| Daily Summary | Auto-computed from transactions |
| Reconciliation | Excel vs DB comparison report |

---

## 📝 Notes for Implementation

1. **Financial Precision:** All amounts in **paise (integer)**. Never use float.
2. **Idempotency:** Every mutation needs `client_operation_id` (UUID v4).
3. **Offline-First:** Design all writes as local-first with sync queue.
4. **RLS by Default:** No table accessible without policy.
5. **Audit Everything:** Financial mutations → `audit_logs`.
6. **Import Safety:** Staging tables, validation, reconciliation report, approval gate.
7. **Portal IDs:** Preserve `portal_customer_id` as TEXT, exact match.
8. **Date Handling:** Store as `DATE` (no timezone). Display in IST (Asia/Kolkata).

---

*Ready for user feedback on critical questions. Phase 2 begins upon confirmation.*