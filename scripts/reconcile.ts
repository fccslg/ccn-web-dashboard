#!/usr/bin/env tsx
/**
 * Reconciliation Script for CCN Business Management System
 * Compares Excel data with database to verify import accuracy
 *
 * Usage: pnpm reconcile [--file=path] [--month=August] [--output=json|csv]
 */

import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { toPaise, formatINR, parseINR } from '../packages/shared/src/utils/formatters.js';
import { reconcileTotals, ReconciliationResult } from '../packages/shared/src/utils/calculations.js';
import type { Paise, ReconciliationReport, Discrepancy } from '../packages/shared/src/types/index.js';

// ============================================
// Configuration
// ============================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const DEFAULT_FILE = resolve(PROJECT_ROOT, 'Bookkeeping.xlsx');
const ORG_ID = '11111111-1111-1111-1111-111111111111';

// ============================================
// Reconciliation Engine
// ============================================

class Reconciler {
  private supabase: ReturnType<typeof createClient>;
  private filePath: string;
  private month: string;
  private outputFormat: 'json' | 'csv' | 'console';

  constructor(filePath: string, month: string, outputFormat: 'json' | 'csv' | 'console') {
    this.filePath = filePath;
    this.month = month;
    this.outputFormat = outputFormat;
    this.supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY!, {
      auth: { persistSession: false },
    });
  }

  async run(): Promise<void> {
    console.log('🔍 Starting Reconciliation...');
    console.log(`📁 File: ${this.filePath}`);
    console.log(`📅 Month: ${this.month}`);
    console.log('');

    // Load Excel data
    const excelData = this.loadExcelMonth(this.month);
    if (!excelData) {
      console.error(`❌ Month "${this.month}" not found in workbook`);
      process.exit(1);
    }

    // Load database data
    const dbData = await this.loadDatabaseMonth(this.month);

    // Compare
    const report = this.generateReport(excelData, dbData);

    // Output
    this.outputReport(report);

    // Exit code based on result
    if (!report.matches && this.hasCriticalDiscrepancies(report)) {
      process.exit(1);
    }
  }

  private loadExcelMonth(month: string): { collection: any[]; cashbook: any[]; summary: any } | null {
    const workbook = XLSX.readFile(this.filePath);
    const sheet = workbook.Sheets[month];
    if (!sheet) return null;

    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false });

    // Find header row
    const headerIdx = this.findHeaderRow(data);
    if (headerIdx === -1) return null;

    // Parse collection register
    const collection = this.parseCollectionRegister(data, headerIdx);

    // Parse cashbook
    const cashbook = this.parseCashbook(data, headerIdx);

    // Parse summary (rows 0-7)
    const summary = this.parseSummary(data);

    return { collection, cashbook, summary };
  }

  private findHeaderRow(data: unknown[][]): number {
    for (let i = 0; i < Math.min(data.length, 20); i++) {
      const row = data[i] as (string | null)[];
      if (!row) continue;
      const rowStr = row.map(c => String(c || '')).join(' ').toLowerCase();
      if (rowStr.includes('p bal') && rowStr.includes('bill') && rowStr.includes('paid')) {
        return i;
      }
    }
    return -1;
  }

  private parseCollectionRegister(data: unknown[][], headerIdx: number): any[] {
    const results = [];
    let currentDate = '';

    for (let i = headerIdx + 1; i < data.length; i++) {
      const row = data[i] as (string | number | Date | null)[];
      if (!row) continue;

      const hasData = row.some(c => c !== null && c !== '' && c !== undefined);
      if (!hasData) continue;

      const dateVal = row[0];
      const idVal = row[1];
      const pBalVal = row[5];
      const billVal = row[6];
      const discountVal = row[7];
      const totalVal = row[8];
      const pDateVal = row[9];
      const paidVal = row[10];
      const dueVal = row[11];
      const locationVal = row[13];
      const modeVal = row[14];
      const doneByVal = row[15];
      const homeCollVal = row[16];
      const remarksVal = row[19];

      if (dateVal) currentDate = this.parseDate(dateVal);

      if (!idVal) continue;

      results.push({
        date: currentDate,
        portal_customer_id: String(idVal).trim(),
        p_bal: this.parseAmount(pBalVal),
        bill: this.parseAmount(billVal),
        discount: this.parseAmount(discountVal),
        total: this.parseAmount(totalVal),
        p_date: this.parseDate(pDateVal),
        paid: this.parseAmount(paidVal),
        due: this.parseAmount(dueVal),
        location: String(locationVal || '').trim(),
        mode: String(modeVal || '').trim(),
        done_by: String(doneByVal || '').trim(),
        home_coll: String(homeCollVal || '').trim(),
        remarks: String(remarksVal || '').trim(),
      });
    }

    return results;
  }

  private parseCashbook(data: unknown[][], headerIdx: number): any[] {
    const results = [];

    for (let i = headerIdx + 1; i < data.length; i++) {
      const row = data[i] as (string | number | Date | null)[];
      if (!row || row.length < 28) continue;

      const dateVal = row[21];
      const categoryVal = row[22];
      const particularsVal = row[23];
      const creditVal = row[24];
      const debitVal = row[25];
      const balanceVal = row[26];
      const remarksVal = row[27];

      if (!dateVal && !categoryVal && !particularsVal) continue;

      results.push({
        date: this.parseDate(dateVal),
        category: String(categoryVal || '').trim(),
        particulars: String(particularsVal || '').trim(),
        credit: this.parseAmount(creditVal),
        debit: this.parseAmount(debitVal),
        balance: this.parseAmount(balanceVal),
        remarks: String(remarksVal || '').trim(),
      });
    }

    return results;
  }

  private parseSummary(data: unknown[][]): any {
    const getVal = (row: number, col: number) => {
      const r = data[row];
      if (!r || r.length <= col) return 0;
      return this.parseAmount(r[col]);
    };

    return {
      collection: getVal(1, 3),     // D2
      advance: getVal(1, 25),       // Z2
      opening_balance: getVal(2, 3), // D3
      deposit_return: getVal(2, 24), // Y3
      deposit: getVal(2, 25),        // Z3
      collector_collection: getVal(3, 3), // D4
      chandan_collection: getVal(3, 6),   // G4
      income: getVal(4, 3),          // D5
      cash_collection: getVal(4, 6),    // G5
      expense: getVal(5, 3),         // D6
      commission: getVal(3, 25),     // Z4
      salary: getVal(5, 25),         // Z6
      closing_balance: getVal(6, 3), // D7
    };
  }

  private async loadDatabaseMonth(month: string): Promise<any> {
    const monthMap: Record<string, number> = {
      'January': 1, 'February': 2, 'March': 3, 'April': 4, 'May': 5, 'June': 6,
      'July': 7, 'August': 8, 'September': 9, 'October': 10, 'November': 11, 'December': 12
    };
    const monthNum = monthMap[month];
    const year = 2025;
    const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(monthNum).padStart(2, '0')}-31`;

    // Get payments for this month
    const { data: payments } = await this.supabase
      .from('payment_transactions')
      .select(`
        *,
        customers!inner(portal_customer_id, name),
        billing_records!left(billing_month, total_due)
      `)
      .eq('organization_id', ORG_ID)
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate)
      .order('transaction_date', { ascending: true });

    // Get cashbook entries
    const { data: cashbook } = await this.supabase
      .from('cashbook_entries')
      .select('*')
      .eq('organization_id', ORG_ID)
      .gte('entry_date', startDate)
      .lte('entry_date', endDate)
      .order('entry_date', { ascending: true });

    // Get daily summary
    const { data: summary } = await this.supabase
      .from('daily_summaries')
      .select('*')
      .eq('organization_id', ORG_ID)
      .eq('summary_date', startDate)
      .single();

    return {
      payments: payments || [],
      cashbook: cashbook || [],
      summary: summary || null,
    };
  }

  private generateReport(excel: any, db: any): ReconciliationReport {
    // Aggregate Excel totals
    const excelBilled = excel.collection.reduce((sum: number, r: any) => sum + (r.bill || 0), 0);
    const excelCollected = excel.collection.reduce((sum: number, r: any) => sum + (r.paid || 0), 0);
    const excelDiscounts = excel.collection.reduce((sum: number, r: any) => sum + (r.discount || 0), 0);

    // Aggregate DB totals
    const dbBilled = db.payments.reduce((sum: number, p: any) => {
      const bill = p.billing_records?.[0]?.total_due || 0;
      const paid = p.amount_paid || 0;
      // Total due from billing record
      return sum + (bill / 100); // paise to rupees
    }, 0);

    // Actually, let's compare payment amounts directly
    const dbCollected = db.payments.reduce((sum: number, p: any) => sum + (p.amount_paid || 0), 0) / 100;

    // Cashbook comparison
    const excelCashbookIncome = excel.cashbook
      .filter((r: any) => ['collection', 'income', 'deposit_return'].includes(r.category))
      .reduce((sum: number, r: any) => sum + (r.credit || 0), 0);

    const excelCashbookExpense = excel.cashbook
      .filter((r: any) => ['expense', 'commission', 'salary', 'advance', 'deposit'].includes(r.category))
      .reduce((sum: number, r: any) => sum + (r.debit || 0), 0);

    const dbCashbookIncome = db.cashbook
      .filter((r: any) => ['collection', 'income', 'deposit_return'].includes(r.category))
      .reduce((sum: number, r: any) => sum + (r.credit_amount || 0), 0) / 100;

    const dbCashbookExpense = db.cashbook
      .filter((r: any) => ['expense', 'commission', 'salary', 'advance', 'deposit'].includes(r.category))
      .reduce((sum: number, r: any) => sum + (r.debit_amount || 0), 0) / 100;

    // Summary comparison
    const excelClosing = excel.summary.closing_balance || 0;
    const dbClosing = db.summary?.closing_balance ? db.summary.closing_balance / 100 : 0;

    // Build discrepancies
    const discrepancies: Discrepancy[] = [];

    if (Math.abs(excelBilled - dbBilled) > 1) {
      discrepancies.push({
        type: 'billing',
        description: 'Total billed amount mismatch',
        excel_value: toPaise(excelBilled),
        db_value: toPaise(dbBilled),
        severity: 'critical',
      });
    }

    if (Math.abs(excelCollected - dbCollected) > 1) {
      discrepancies.push({
        type: 'collection',
        description: 'Total collected amount mismatch',
        excel_value: toPaise(excelCollected),
        db_value: toPaise(dbCollected),
        severity: 'critical',
      });
    }

    if (Math.abs(excelCashbookIncome - dbCashbookIncome) > 1) {
      discrepancies.push({
        type: 'cashbook',
        description: 'Cashbook income mismatch',
        excel_value: toPaise(excelCashbookIncome),
        db_value: toPaise(dbCashbookIncome),
        severity: 'major',
      });
    }

    if (Math.abs(excelCashbookExpense - dbCashbookExpense) > 1) {
      discrepancies.push({
        type: 'cashbook',
        description: 'Cashbook expense mismatch',
        excel_value: toPaise(excelCashbookExpense),
        db_value: toPaise(dbCashbookExpense),
        severity: 'major',
      });
    }

    if (Math.abs(excelClosing - dbClosing) > 1) {
      discrepancies.push({
        type: 'summary',
        description: 'Closing balance mismatch',
        excel_value: toPaise(excelClosing),
        db_value: toPaise(dbClosing),
        severity: 'critical',
      });
    }

    // Customer-level balance check
    const customerBalances = this.checkCustomerBalances(excel.collection, db.payments);
    discrepancies.push(...customerBalances);

    const matches = discrepancies.filter(d => d.severity === 'critical').length === 0;

    return {
      total_billed_excel: toPaise(excelBilled),
      total_billed_db: toPaise(dbBilled),
      total_collected_excel: toPaise(excelCollected),
      total_collected_db: toPaise(dbCollected),
      total_discounts_excel: toPaise(excelDiscounts),
      total_discounts_db: toPaise(0), // TODO: compute from DB
      customer_balances_match: customerBalances.length === 0,
      cashbook_income_excel: toPaise(excelCashbookIncome),
      cashbook_income_db: toPaise(dbCashbookIncome),
      cashbook_expense_excel: toPaise(excelCashbookExpense),
      cashbook_expense_db: toPaise(dbCashbookExpense),
      closing_balance_excel: toPaise(excelClosing),
      closing_balance_db: toPaise(dbClosing),
      discrepancies,
    };
  }

  private checkCustomerBalances(excelCollections: any[], dbPayments: any[]): Discrepancy[] {
    const discrepancies: Discrepancy[] = [];

    // Group Excel by customer
    const excelByCustomer = new Map<string, { total_paid: number; total_due: number; count: number }>();
    for (const r of excelCollections) {
      const id = r.portal_customer_id;
      const existing = excelByCustomer.get(id) || { total_paid: 0, total_due: 0, count: 0 };
      existing.total_paid += r.paid || 0;
      existing.total_due += r.due || 0;
      existing.count += 1;
      excelByCustomer.set(id, existing);
    }

    // Group DB by customer
    const dbByCustomer = new Map<string, { total_paid: number; count: number }>();
    for (const p of dbPayments) {
      const id = p.customers?.portal_customer_id || '';
      const existing = dbByCustomer.get(id) || { total_paid: 0, count: 0 };
      existing.total_paid += (p.amount_paid || 0) / 100;
      existing.count += 1;
      dbByCustomer.set(id, existing);
    }

    // Compare
    for (const [id, excel] of excelByCustomer) {
      const db = dbByCustomer.get(id);
      if (!db) {
        discrepancies.push({
          type: 'collection',
          description: `Customer ${id} missing in database`,
          excel_value: toPaise(excel.total_paid),
          db_value: toPaise(0),
          row_reference: id,
          severity: 'critical',
        });
        continue;
      }

      if (Math.abs(excel.total_paid - db.total_paid) > 1) {
        discrepancies.push({
          type: 'collection',
          description: `Customer ${id} payment total mismatch`,
          excel_value: toPaise(excel.total_paid),
          db_value: toPaise(db.total_paid),
          row_reference: id,
          severity: 'major',
        });
      }
    }

    return discrepancies;
  }

  private hasCriticalDiscrepancies(report: ReconciliationReport): boolean {
    return report.discrepancies.some(d => d.severity === 'critical');
  }

  private outputReport(report: ReconciliationReport): void {
    if (this.outputFormat === 'json') {
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    if (this.outputFormat === 'csv') {
      this.outputCSV(report);
      return;
    }

    // Console output
    console.log('\n' + '='.repeat(70));
    console.log(`📊 RECONCILIATION REPORT - ${this.month.toUpperCase()}`);
    console.log('='.repeat(70));

    console.log('\n📈 TOTALS COMPARISON:');
    console.log(`   Total Billed:     Excel: ${formatINR(report.total_billed_excel).padStart(15)}  DB: ${formatINR(report.total_billed_db).padStart(15)}`);
    console.log(`   Total Collected:  Excel: ${formatINR(report.total_collected_excel).padStart(15)}  DB: ${formatINR(report.total_collected_db).padStart(15)}`);
    console.log(`   Total Discounts:  Excel: ${formatINR(report.total_discounts_excel).padStart(15)}  DB: ${formatINR(report.total_discounts_db).padStart(15)}`);
    console.log(`   Cashbook Income:  Excel: ${formatINR(report.cashbook_income_excel).padStart(15)}  DB: ${formatINR(report.cashbook_income_db).padStart(15)}`);
    console.log(`   Cashbook Expense: Excel: ${formatINR(report.cashbook_expense_excel).padStart(15)}  DB: ${formatINR(report.cashbook_expense_db).padStart(15)}`);
    console.log(`   Closing Balance:  Excel: ${formatINR(report.closing_balance_excel).padStart(15)}  DB: ${formatINR(report.closing_balance_db).padStart(15)}`);

    console.log('\n🎯 CUSTOMER BALANCES:', report.customer_balances_match ? '✅ MATCH' : '❌ MISMATCH');

    console.log('\n🔴 DISCREPANCIES:');
    if (report.discrepancies.length === 0) {
      console.log('   None ✅');
    } else {
      for (const d of report.discrepancies) {
        const icon = d.severity === 'critical' ? '🔴' : d.severity === 'major' ? '🟠' : '🟡';
        console.log(`   ${icon} [${d.type.toUpperCase()}] ${d.description}`);
        console.log(`      Excel: ${formatINR(d.excel_value)}  DB: ${formatINR(d.db_value)}  Diff: ${formatINR(toPaise(Math.abs(toPaise(d.excel_value) - toPaise(d.db_value))))}`);
        if (d.row_reference) console.log(`      Ref: ${d.row_reference}`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log(report.discrepancies.filter(d => d.severity === 'critical').length === 0
      ? '✅ RECONCILIATION PASSED'
      : '❌ RECONCILIATION FAILED - Critical discrepancies found');
    console.log('='.repeat(70));
  }

  private outputCSV(report: ReconciliationReport): void {
    console.log('type,description,excel_value,db_value,difference,severity,row_reference');
    for (const d of report.discrepancies) {
      const diff = toPaise(Math.abs(toPaise(d.excel_value) - toPaise(d.db_value)));
      console.log(`${d.type},"${d.description}",${toRupees(d.excel_value)},${toRupees(d.db_value)},${toRupees(diff)},${d.severity},${d.row_reference || ''}`);
    }
  }

  private parseAmount(val: string | number | Date | null): number {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    if (val instanceof Date) return 0;
    const cleaned = String(val).replace(/[₹,\s]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }

  private parseDate(val: string | number | Date): string {
    if (val instanceof Date) {
      return `${val.getFullYear()}-${String(val.getMonth() + 1).padStart(2, '0')}-${String(val.getDate()).padStart(2, '0')}`;
    }
    if (typeof val === 'number') {
      const date = new Date((val - 25569) * 86400 * 1000);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }
    // Try to parse Indian date format
    const str = String(val).trim();
    const match = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (match) {
      return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
    }
    return str;
  }
}

// Helper
function toRupees(paise: number): number {
  return paise / 100;
}

// ============================================
// CLI Entry Point
// ============================================

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      file: { type: 'string', short: 'f', default: DEFAULT_FILE },
      month: { type: 'string', short: 'm', default: 'August' },
      output: { type: 'string', short: 'o', default: 'console' },
    },
    strict: true,
  });

  const reconciler = new Reconciler(values.file, values.month, values.output as 'json' | 'csv' | 'console');
  await reconciler.run();
}

main();