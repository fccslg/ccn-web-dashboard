/**
 * Core Business Logic Calculations
 * All amounts in PAISE (integer)
 *
 * IMPORTANT: Due Calculation Convention
 * Excel: Due = Paid - Total (where Total = Bill - P_Bal - Discount)
 * - Negative Due = Customer still owes (underpaid)
 * - Positive Due = Customer overpaid (advance/credit)
 *
 * We store BOTH:
 * - due_excel: Paid - Total (matches Excel convention for compatibility)
 * - outstanding_standard: Total - Paid (standard accounting: positive = owes)
 */

import type { Paise, BillingRecord, PaymentTransaction } from '../types';
import { toPaise, toRupees } from '../types';

// ============================================
// Billing Calculations
// ============================================

/**
 * Calculate total due for a billing record
 * Formula: Total = Bill - Previous_Balance - Discount
 *
 * Note: P_Bal is SIGNED
 * - Negative P_Bal = customer owes from previous month → increases total due
 * - Positive P_Bal = customer has credit → decreases total due
 */
export function calculateTotalDue(
  billAmount: Paise,
  previousBalance: Paise, // SIGNED
  discount: Paise
): Paise {
  // Total = Bill - P_Bal - Discount
  // If P_Bal = -36 (owes 36), then: Bill - (-36) - Discount = Bill + 36 - Discount
  // If P_Bal = +38 (credit 38), then: Bill - 38 - Discount
  return toPaise(toRupees(billAmount) - toRupees(previousBalance) - toRupees(discount));
}

/**
 * Calculate due after payment (Excel convention)
 * Formula: Due = Paid - Total
 * - Negative = Customer still owes (underpaid)
 * - Positive = Customer overpaid (advance)
 */
export function calculateDueExcel(
  amountPaid: Paise,
  totalDue: Paise
): Paise {
  return toPaise(toRupees(amountPaid) - toRupees(totalDue));
}

/**
 * Calculate outstanding (Standard accounting convention)
 * Formula: Outstanding = Total - Paid
 * - Positive = Customer owes money
 * - Negative = Customer has credit/advance
 */
export function calculateOutstandingStandard(
  totalDue: Paise,
  amountPaid: Paise
): Paise {
  return toPaise(toRupees(totalDue) - toRupees(amountPaid));
}

/**
 * Calculate both due conventions for a payment
 */
export function calculatePaymentDues(
  amountPaid: Paise,
  totalDue: Paise
): { due_excel: Paise; outstanding_standard: Paise } {
  return {
    due_excel: calculateDueExcel(amountPaid, totalDue),
    outstanding_standard: calculateOutstandingStandard(totalDue, amountPaid),
  };
}

/**
 * Calculate previous balance for next month (carry forward)
 * Uses the standard outstanding convention
 * If customer owes (positive outstanding), that becomes next month's P_Bal (negative)
 * If customer has credit (negative outstanding), that becomes next month's P_Bal (positive)
 */
export function calculateCarryForwardPBal(
  totalDue: Paise,
  amountPaid: Paise
): Paise {
  const outstanding = calculateOutstandingStandard(totalDue, amountPaid);
  // Convert to P_Bal convention: negative = owes, positive = credit
  // outstanding positive (owes) → P_Bal negative
  // outstanding negative (credit) → P_Bal positive
  return toPaise(-toRupees(outstanding));
}

/**
 * Validate billing record calculations match expected values
 */
export function validateBillingRecord(record: BillingRecord): {
  valid: boolean;
  errors: string[];
  computed_total_due: Paise;
  computed_due_excel: Paise | null;
  computed_outstanding_standard: Paise | null;
} {
  const errors: string[] = [];
  const computed_total_due = calculateTotalDue(
    record.bill_amount,
    record.previous_balance,
    record.discount
  );

  if (computed_total_due !== record.total_due) {
    errors.push(
      `total_due mismatch: stored=${toRupees(record.total_due)}, computed=${toRupees(computed_total_due)}`
    );
  }

  // Note: We can't compute due_excel/outstanding without payment data
  // Those are computed per-payment-transaction

  return {
    valid: errors.length === 0,
    errors,
    computed_total_due,
    computed_due_excel: null,
    computed_outstanding_standard: null,
  };
}

// ============================================
// Cashbook Calculations
// ============================================

/**
 * Calculate running balance for cashbook entry
 * Running Balance = Previous Balance + Credit - Debit
 */
export function calculateRunningBalance(
  previousBalance: Paise,
  creditAmount: Paise,
  debitAmount: Paise
): Paise {
  return toPaise(toRupees(previousBalance) + toRupees(creditAmount) - toRupees(debitAmount));
}

/**
 * Validate cashbook running balance continuity
 */
export function validateCashbookSequence(entries: Array<{
  entry_date: string;
  credit_amount: Paise;
  debit_amount: Paise;
  running_balance: Paise;
}>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (entries.length === 0) return { valid: true, errors: [] };

  // Sort by date
  const sorted = [...entries].sort((a, b) => a.entry_date.localeCompare(b.entry_date));

  let expectedBalance = sorted[0].running_balance;

  for (let i = 1; i < sorted.length; i++) {
    const entry = sorted[i];
    expectedBalance = calculateRunningBalance(
      expectedBalance,
      entry.credit_amount,
      entry.debit_amount
    );

    if (expectedBalance !== entry.running_balance) {
      errors.push(
        `Row ${i + 1} (${entry.entry_date}): running_balance mismatch. Expected ${toRupees(expectedBalance)}, got ${toRupees(entry.running_balance)}`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================
// Daily Summary Calculations
// ============================================

/**
 * Calculate closing balance from summary components
 * Closing = Opening + Collector_Collection + Income - Expense
 */
export function calculateClosingBalance(
  openingBalance: Paise,
  collectorCollection: Paise,
  income: Paise,
  expense: Paise
): Paise {
  return toPaise(
    toRupees(openingBalance) +
    toRupees(collectorCollection) +
    toRupees(income) -
    toRupees(expense)
  );
}

/**
 * Validate daily summary
 */
export function validateDailySummary(summary: {
  opening_balance: Paise;
  collector_collection: Paise;
  income: Paise;
  expense: Paise;
  closing_balance: Paise;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const computed = calculateClosingBalance(
    summary.opening_balance,
    summary.collector_collection,
    summary.income,
    summary.expense
  );

  if (computed !== summary.closing_balance) {
    errors.push(
      `closing_balance mismatch: stored=${toRupees(summary.closing_balance)}, computed=${toRupees(computed)}`
    );
  }

  return { valid: errors.length === 0, errors };
}

// ============================================
// Aggregation Helpers
// ============================================

/**
 * Aggregate payment transactions by date
 */
export function aggregatePaymentsByDate(
  payments: PaymentTransaction[]
): Map<string, { total_paid: Paise; count: number; by_mode: Map<PaymentTransaction['payment_mode'], Paise> }> {
  const result = new Map();

  for (const p of payments) {
    const date = p.transaction_date;
    const existing = result.get(date) || {
      total_paid: toPaise(0),
      count: 0,
      by_mode: new Map(),
    };

    existing.total_paid = toPaise(toRupees(existing.total_paid) + toRupees(p.amount_paid));
    existing.count += 1;

    const modeTotal = existing.by_mode.get(p.payment_mode) || toPaise(0);
    existing.by_mode.set(p.payment_mode, toPaise(toRupees(modeTotal) + toRupees(p.amount_paid)));

    result.set(date, existing);
  }

  return result;
}

/**
 * Aggregate cashbook entries by date and category
 */
export function aggregateCashbookByDateAndCategory(
  entries: Array<{ entry_date: string; category: string; credit_amount: Paise; debit_amount: Paise }>
): Map<string, Map<string, { credit: Paise; debit: Paise; net: Paise }>> {
  const result = new Map();

  for (const e of entries) {
    const dateMap = result.get(e.entry_date) || new Map();
    const catMap = dateMap.get(e.category) || { credit: toPaise(0), debit: toPaise(0), net: toPaise(0) };

    catMap.credit = toPaise(toRupees(catMap.credit) + toRupees(e.credit_amount));
    catMap.debit = toPaise(toRupees(catMap.debit) + toRupees(e.debit_amount));
    catMap.net = toPaise(toRupees(catMap.credit) - toRupees(catMap.debit));

    dateMap.set(e.category, catMap);
    result.set(e.entry_date, dateMap);
  }

  return result;
}

/**
 * Compute collector-wise collection totals
 */
export function computeCollectorTotals(
  payments: PaymentTransaction[]
): Map<string, { cash: Paise; digital: Paise; total: Paise; count: number }> {
  const result = new Map();

  for (const p of payments) {
    const collector = p.collector_name || 'Unknown';
    const existing = result.get(collector) || { cash: toPaise(0), digital: toPaise(0), total: toPaise(0), count: 0 };

    existing.total = toPaise(toRupees(existing.total) + toRupees(p.amount_paid));
    existing.count += 1;

    if (p.payment_mode === 'cash') {
      existing.cash = toPaise(toRupees(existing.cash) + toRupees(p.amount_paid));
    } else {
      existing.digital = toPaise(toRupees(existing.digital) + toRupees(p.amount_paid));
    }

    result.set(collector, existing);
  }

  return result;
}

// ============================================
// Date Utilities
// ============================================

export function getFirstOfMonth(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export function getLastOfMonth(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-${String(nextMonth.getDate()).padStart(2, '0')}`;
}

export function addMonths(date: string, months: number): string {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function isFirstOfMonth(date: string): boolean {
  return date.endsWith('-01');
}

// ============================================
// Customer ID Utilities
// ============================================

export function normalizePortalCustomerId(id: string): string {
  // Trim whitespace, preserve case for alphanumeric IDs like FCC036, rajusarkar
  return id.trim();
}

export function isNumericCustomerId(id: string): boolean {
  return /^\d+$/.test(id);
}

export function generateClientOperationId(): string {
  // UUID v4 for idempotency
  return crypto.randomUUID();
}

// ============================================
// Reconciliation Helpers
// ============================================

export interface ReconciliationResult {
  matches: boolean;
  discrepancies: Array<{
    field: string;
    excel: Paise;
    database: Paise;
    difference: Paise;
  }>;
}

export function reconcileTotals(
  excelTotals: Record<string, Paise>,
  dbTotals: Record<string, Paise>
): ReconciliationResult {
  const discrepancies: ReconciliationResult['discrepancies'] = [];
  let matches = true;

  const allKeys = new Set([...Object.keys(excelTotals), ...Object.keys(dbTotals)]);

  for (const key of allKeys) {
    const excel = excelTotals[key] || toPaise(0);
    const db = dbTotals[key] || toPaise(0);
    const difference = toPaise(toRupees(db) - toRupees(excel));

    if (difference !== 0) {
      matches = false;
      discrepancies.push({ field: key, excel, database: db, difference });
    }
  }

  return { matches, discrepancies };
}