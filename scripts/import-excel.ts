#!/usr/bin/env tsx
/**
 * Excel Import Script for CCN Business Management System
 * Imports data from Bookkeeping.xlsx into Supabase database
 *
 * Usage: pnpm import:excel [--file=path] [--sheet=name] [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { toPaise, formatINR } from '../packages/shared/src/utils/formatters.js';
import { calculateTotalDue, calculateCarryForwardPBal, validateBillingRecord } from '../packages/shared/src/utils/calculations.js';
import { normalizePortalCustomerId, formatPortalCustomerId, parseIndianDate, generateClientOperationId } from '../packages/shared/src/utils/calculations.js';
import { validatePaymentTransaction, validateCashbookEntry, validateCustomerSearch, CollectionFormSchema, CashbookEntryCreateSchema } from '../packages/shared/src/validation/schemas.js';
import type { Paise } from '../packages/shared/src/types/index.js';

// ============================================
// Configuration
// ============================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const DEFAULT_FILE = resolve(PROJECT_ROOT, 'Bookkeeping.xlsx');
const ORG_ID = '11111111-1111-1111-1111-111111111111'; // Default org from seed

// ============================================
// Types
// ============================================

interface ImportOptions {
  file: string;
  sheets?: string[];
  dryRun: boolean;
  batchSize: number;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface ImportStats {
  total: number;
  imported: number;
  failed: number;
  skipped: number;
  errors: Array<{ row: number; sheet: string; message: string }>;
}

// ============================================
// Main Import Class
// ============================================

class ExcelImporter {
  private supabase: ReturnType<typeof createClient>;
  private options: ImportOptions;
  private stats: ImportStats = { total: 0, imported: 0, failed: 0, skipped: 0, errors: [] };
  private customerCache: Map<string, string> = new Map(); // portal_customer_id -> customer.id
  private accountCache: Map<string, string> = new Map(); // customer_id -> account.id
  private billingCache: Map<string, string> = new Map(); // account_id|billing_month -> billing_record.id
  private lastPBalCache: Map<string, Paise> = new Map(); // customer_id -> last P_Bal

  constructor(options: ImportOptions) {
    this.options = options;
    this.supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY!, {
      auth: { persistSession: false },
    });
  }

  async run(): Promise<void> {
    console.log('🚀 Starting Excel Import...');
    console.log(`📁 File: ${this.options.file}`);
    console.log(`🏢 Organization: ${ORG_ID}`);
    console.log(`🔧 Dry run: ${this.options.dryRun ? 'YES' : 'NO'}`);
    console.log('');

    // Load workbook
    const workbook = XLSX.readFile(this.options.file);
    const sheets = this.options.sheets || this.getDefaultSheets(workbook);

    // Import in order: reference sheets first, then monthly sheets
    const importOrder = this.getImportOrder(sheets);

    for (const sheetName of importOrder) {
      if (!workbook.Sheets[sheetName]) {
        console.warn(`⚠️  Sheet "${sheetName}" not found, skipping`);
        continue;
      }

      console.log(`\n📄 Processing sheet: ${sheetName}`);
      await this.importSheet(workbook, sheetName);
    }

    this.printSummary();
  }

  private getDefaultSheets(workbook: XLSX.WorkBook): string[] {
    // Priority order for import
    const priority = [
      'Combo Ref',
      'Cable Ref',
      'Internet Ref',
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return priority.filter(s => workbook.Sheets[s]);
  }

  private getImportOrder(sheets: string[]): string[] {
    // Reference sheets first
    const refSheets = ['Combo Ref', 'Cable Ref', 'Internet Ref'];
    const monthlySheets = sheets.filter(s => !refSheets.includes(s));
    return [...refSheets.filter(s => sheets.includes(s)), ...monthlySheets.sort()];
  }

  private async importSheet(workbook: XLSX.WorkBook, sheetName: string): Promise<void> {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false });

    if (data.length === 0) {
      console.log('   Empty sheet, skipping');
      return;
    }

    // Detect sheet type and dispatch
    if (sheetName === 'Combo Ref') {
      await this.importComboRef(data);
    } else if (sheetName === 'Cable Ref') {
      await this.importCableRef(data);
    } else if (sheetName === 'Internet Ref') {
      await this.importInternetRef(data);
    } else if (this.isMonthlySheet(sheetName)) {
      await this.importMonthlySheet(sheetName, data);
    } else {
      console.log(`   Unknown sheet type, skipping`);
    }
  }

  private isMonthlySheet(name: string): boolean {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return months.includes(name);
  }

  // ============================================
  // Reference Sheet Imports
  // ============================================

  private async importComboRef(data: unknown[][]): Promise<void> {
    console.log('   📥 Importing Combo Ref (Customer Master)...');

    // Headers: Row 1 = LCOID, Name, Mobile, Address, (empty), Display
    // Data starts from row 2 (index 1)
    for (let i = 1; i < data.length; i++) {
      const row = data[i] as (string | number | null)[];
      if (!row || row.length < 4) continue;

      const portalId = normalizePortalCustomerId(String(row[0] || ''));
      if (!portalId) continue;

      const name = String(row[1] || '').trim();
      const mobile = String(row[2] || '').trim() || null;
      const address = String(row[3] || '').trim() || null;

      if (!name) continue;

      const customerData = {
        organization_id: ORG_ID,
        portal_customer_id: portalId,
        name,
        mobile: this.normalizeMobile(mobile),
        address,
        location: this.extractLocation(address),
        cable_ref_id: null,
        internet_ref_id: null,
        status: 'active' as const,
        metadata: { source_sheet: 'Combo Ref', source_row: i + 1 },
      };

      await this.upsertCustomer(customerData);
      this.stats.total++;
    }
    console.log(`   ✅ Processed ${this.stats.imported} customers from Combo Ref`);
  }

  private async importCableRef(data: unknown[][]): Promise<void> {
    console.log('   📥 Importing Cable Ref (STB Details)...');

    // Headers: LCOID, Name, Mobile, Address, Serial Number, VC Number
    for (let i = 1; i < data.length; i++) {
      const row = data[i] as (string | number | null)[];
      if (!row || row.length < 4) continue;

      const portalId = normalizePortalCustomerId(String(row[0] || ''));
      const serial = String(row[4] || '').trim() || null;
      const vc = String(row[5] || '').trim() || null;

      if (!portalId) continue;

      // Update existing customer with cable details
      const customerId = this.customerCache.get(portalId);
      if (customerId) {
        await this.updateCustomer(customerId, {
          cable_ref_id: serial,
          metadata: {
            source_sheet: 'Cable Ref',
            source_row: i + 1,
            vc_number: vc,
          },
        });
        this.stats.imported++;
      }
    }
    console.log(`   ✅ Updated ${this.stats.imported} customers with Cable Ref data`);
  }

  private async importInternetRef(data: unknown[][]): Promise<void> {
    console.log('   📥 Importing Internet Ref (Broadband Customers)...');

    // Headers: Status, ID, Name, Mobile, Address, ...
    // Data starts from row 2 (index 1)
    for (let i = 1; i < data.length; i++) {
      const row = data[i] as (string | number | null)[];
      if (!row || row.length < 5) continue;

      const portalId = normalizePortalCustomerId(String(row[1] || ''));
      const name = String(row[2] || '').trim();
      const mobile = String(row[3] || '').trim() || null;
      const address = String(row[4] || '').trim() || null;

      if (!portalId || !name) continue;

      const customerData = {
        organization_id: ORG_ID,
        portal_customer_id: portalId,
        name,
        mobile: this.normalizeMobile(mobile),
        address,
        location: this.extractLocation(address),
        cable_ref_id: null,
        internet_ref_id: portalId,
        status: 'active' as const,
        metadata: { source_sheet: 'Internet Ref', source_row: i + 1 },
      };

      await this.upsertCustomer(customerData);
      this.stats.total++;
    }
    console.log(`   ✅ Processed ${this.stats.imported} customers from Internet Ref`);
  }

  // ============================================
  // Monthly Sheet Import
  // ============================================

  private async importMonthlySheet(sheetName: string, data: unknown[][]): Promise<void> {
    console.log(`   📥 Importing Monthly Sheet: ${sheetName}`);

    // Parse month from sheet name
    const monthMap: Record<string, number> = {
      'January': 1, 'February': 2, 'March': 3, 'April': 4, 'May': 5, 'June': 6,
      'July': 7, 'August': 8, 'September': 9, 'October': 10, 'November': 11, 'December': 12
    };
    const month = monthMap[sheetName];
    const year = 2025; // Default, could detect from data
    const billingMonth = `${year}-${String(month).padStart(2, '0')}-01`;

    // Find header row (Row 9 in Excel = index 8)
    // Columns A-T = Collection Register, V-AC = Cashbook
    const headerRowIndex = this.findHeaderRow(data, ['Date', 'ID', 'Name', 'P Bal', 'Bill', 'Paid', 'Due']);
    if (headerRowIndex === -1) {
      console.warn('   ⚠️  Could not find collection register header, skipping');
      return;
    }

    // Import Collection Register (Rows after header)
    await this.importCollectionRegister(sheetName, data, headerRowIndex, billingMonth);

    // Import Cashbook (Columns V-AC = indices 21-27)
    await this.importCashbook(sheetName, data, headerRowIndex);

    // Import Daily Summary (Rows 1-8)
    await this.importDailySummary(sheetName, data, billingMonth);
  }

  private findHeaderRow(data: unknown[][], keywords: string[]): number {
    for (let i = 0; i < Math.min(data.length, 20); i++) {
      const row = data[i] as (string | null)[];
      if (!row) continue;
      const rowStr = row.map(c => String(c || '')).join(' ').toLowerCase();
      if (keywords.every(k => rowStr.includes(k.toLowerCase()))) {
        return i;
      }
    }
    return -1;
  }

  private async importCollectionRegister(
    sheetName: string,
    data: unknown[][],
    headerRowIndex: number,
    billingMonth: string
  ): Promise<void> {
    console.log(`   📊 Importing Collection Register...`);

    let currentDate = '';
    let consecutiveEmpty = 0;

    for (let i = headerRowIndex + 1; i < data.length; i++) {
      const row = data[i] as (string | number | Date | null)[];
      if (!row) continue;

      // Check for empty row (end of data)
      const hasData = row.some(c => c !== null && c !== '' && c !== undefined);
      if (!hasData) {
        consecutiveEmpty++;
        if (consecutiveEmpty > 5) break;
        continue;
      }
      consecutiveEmpty = 0;

      // Parse row - columns A(0) to T(19)
      const dateVal = row[0];
      const idVal = row[1];
      const pBalVal = row[5];    // F
      const billVal = row[6];    // G
      const discountVal = row[7]; // H
      const totalVal = row[8];    // I
      const pDateVal = row[9];    // J
      const paidVal = row[10];    // K
      const dueVal = row[11];     // L
      const locationVal = row[13]; // N
      const modeVal = row[14];     // O
      const doneByVal = row[15];   // P
      const homeCollVal = row[16]; // Q
      const remarksVal = row[19];  // T

      // Update current date if present
      if (dateVal) {
        currentDate = this.parseExcelDate(dateVal);
      }

      // Skip if no customer ID
      if (!idVal) continue;

      const portalCustomerId = normalizePortalCustomerId(String(idVal));
      const customerId = this.customerCache.get(portalCustomerId);

      if (!customerId) {
        this.logError(i + 1, sheetName, `Customer not found: ${portalCustomerId}`);
        this.stats.failed++;
        continue;
      }

      // Get or create customer account
      const accountId = await this.getOrCreateAccount(customerId);
      if (!accountId) {
        this.logError(i + 1, sheetName, `No account for customer: ${portalCustomerId}`);
        this.stats.failed++;
        continue;
      }

      // Parse financial values
      const billAmount = this.parseAmount(billVal) || 0;
      const previousBalance = this.parseAmount(pBalVal) || 0; // SIGNED
      const discount = this.parseAmount(discountVal) || 0;
      const amountPaid = this.parseAmount(paidVal) || 0;

      // Validate/Calculate totals
      const calculatedTotal = calculateTotalDue(
        toPaise(billAmount),
        toPaise(previousBalance),
        toPaise(discount)
      );
      const excelTotal = this.parseAmount(totalVal) || 0;

      // Allow small rounding differences
      if (Math.abs(calculatedTotal - excelTotal) > 100) { // > ₹1 difference
        this.logError(i + 1, sheetName,
          `Total mismatch: Excel=${formatINR(toPaise(excelTotal))}, Calculated=${formatINR(calculatedTotal)}`);
      }

      // Calculate dues
      const { due_excel, outstanding_standard } = calculatePaymentDues(
        toPaise(amountPaid),
        calculatedTotal
      );
      const excelDue = this.parseAmount(dueVal) || 0;

      // Get billing record for this month
      const billingRecordId = await this.getOrCreateBillingRecord(
        accountId,
        billingMonth,
        toPaise(billAmount),
        toPaise(previousBalance),
        toPaise(discount)
      );

      // Create payment transaction
      const paymentData = {
        organization_id: ORG_ID,
        billing_record_id: billingRecordId,
        customer_id: customerId,
        employee_id: await this.getEmployeeIdByName(String(doneByVal || '')),
        transaction_date: currentDate || billingMonth,
        amount_paid: toPaise(amountPaid),
        payment_mode: this.parsePaymentMode(String(modeVal || '')),
        location: this.parseLocation(String(locationVal || '')),
        collector_name: String(doneByVal || '').trim() || null,
        sub_collector: String(homeCollVal || '').trim() || null,
        remarks: String(remarksVal || '').trim() || null,
        is_offline: false,
        sync_status: 'synced' as const,
        client_operation_id: generateClientOperationId(),
      };

      await this.insertPaymentTransaction(paymentData);
      this.stats.imported++;
      this.stats.total++;

      // Update last P_Bal for carry-forward
      this.lastPBalCache.set(customerId, due_excel);
    }
  }

  private async importCashbook(
    sheetName: string,
    data: unknown[][],
    headerRowIndex: number
  ): Promise<void> {
    console.log(`   💰 Importing Cashbook...`);

    // Cashbook columns: V(21) to AC(27)
    // V=Date, W=Category, X=Particulars, Y=Credit, Z=Debit, AA=Balance, AB=Remarks

    let runningBalance = 0;
    let firstEntry = true;

    for (let i = headerRowIndex + 1; i < data.length; i++) {
      const row = data[i] as (string | number | Date | null)[];
      if (!row || row.length < 28) continue;

      const dateVal = row[21];      // V
      const categoryVal = row[22];  // W
      const particularsVal = row[23]; // X
      const creditVal = row[24];    // Y
      const debitVal = row[25];     // Z
      const balanceVal = row[26];   // AA
      const remarksVal = row[27];   // AB

      // Skip empty rows
      if (!dateVal && !categoryVal && !particularsVal) continue;

      const entryDate = this.parseExcelDate(dateVal) || '';
      const category = this.parseCashbookCategory(String(categoryVal || ''));
      const particulars = String(particularsVal || '').trim();
      const creditAmount = this.parseAmount(creditVal) || 0;
      const debitAmount = this.parseAmount(debitVal) || 0;
      const excelBalance = this.parseAmount(balanceVal) || 0;

      if (!entryDate || !category || !particulars) continue;

      // Validate running balance
      if (firstEntry) {
        runningBalance = excelBalance;
        firstEntry = false;
      } else {
        const calculatedBalance = runningBalance + creditAmount - debitAmount;
        if (Math.abs(calculatedBalance - excelBalance) > 100) {
          this.logError(i + 1, sheetName,
            `Cashbook balance mismatch: Excel=${formatINR(toPaise(excelBalance))}, Calculated=${formatINR(toPaise(calculatedBalance))}`);
        }
        runningBalance = excelBalance;
      }

      const cashbookData = {
        organization_id: ORG_ID,
        employee_id: null, // Could infer from particulars
        entry_date: entryDate,
        category,
        particulars,
        credit_amount: toPaise(creditAmount),
        debit_amount: toPaise(debitAmount),
        running_balance: toPaise(runningBalance),
        remarks: String(remarksVal || '').trim() || null,
        is_system_generated: category === 'balance',
        client_operation_id: generateClientOperationId(),
      };

      await this.insertCashbookEntry(cashbookData);
      this.stats.imported++;
      this.stats.total++;
    }
  }

  private async importDailySummary(
    sheetName: string,
    data: unknown[][],
    billingMonth: string
  ): Promise<void> {
    console.log(`   📈 Importing Daily Summary...`);

    // Summary is in rows 1-8 (indices 0-7), columns C(2), D(3), W(22), X(23), Y(24), Z(25), AA(26)
    // Row 2 (index 1): Collection, Advance
    // Row 3 (index 2): Opening Balance, Deposit Return, Deposit
    // Row 4 (index 3): Collector Collection, Chandan Collection, Income, Commission
    // Row 5 (index 4): Income, Cash Collection, Expense
    // Row 6 (index 5): Expense, Salary
    // Row 7 (index 6): Closing Balance

    try {
      const getVal = (row: number, col: number) => {
        const r = data[row];
        if (!r || r.length <= col) return 0;
        return this.parseAmount(r[col]) || 0;
      };

      const summaryData = {
        organization_id: ORG_ID,
        summary_date: billingMonth, // Use month start as summary date
        opening_balance: toPaise(getVal(2, 3)),        // D3
        collector_collection: toPaise(getVal(3, 3)),   // D4
        income: toPaise(getVal(4, 3)),                  // D5
        expense: toPaise(getVal(5, 3)),                 // D6
        chandan_collection: toPaise(getVal(3, 6)),     // G4
        cash_collection: toPaise(getVal(4, 6)),        // G5
        deposit_return: toPaise(getVal(2, 24)),        // Y3
        deposit: toPaise(getVal(2, 25)),               // Z3
        commission: toPaise(getVal(3, 25)),            // Z4
        salary: toPaise(getVal(5, 25)),                // Z6
        advance: toPaise(getVal(1, 25)),               // Z2
      };

      await this.upsertDailySummary(summaryData);
      this.stats.imported++;
      this.stats.total++;
    } catch (e) {
      console.warn(`   ⚠️  Could not import daily summary: ${e}`);
    }
  }

  // ============================================
  // Database Operations
  // ============================================

  private async upsertCustomer(data: {
    organization_id: string;
    portal_customer_id: string;
    name: string;
    mobile: string | null;
    address: string | null;
    location: string | null;
    cable_ref_id: string | null;
    internet_ref_id: string | null;
    status: 'active' | 'inactive' | 'suspended';
    metadata: Record<string, unknown>;
  }): Promise<void> {
    if (this.options.dryRun) {
      this.customerCache.set(data.portal_customer_id, `dry-run-${data.portal_customer_id}`);
      this.stats.imported++;
      return;
    }

    const { data: existing, error: selectError } = await this.supabase
      .from('customers')
      .select('id')
      .eq('organization_id', data.organization_id)
      .eq('portal_customer_id', data.portal_customer_id)
      .single();

    if (selectError && selectError.code !== 'PGRST116') { // Not found is OK
      throw selectError;
    }

    if (existing) {
      this.customerCache.set(data.portal_customer_id, existing.id);
      this.stats.skipped++;
      return;
    }

    const { data: inserted, error } = await this.supabase
      .from('customers')
      .insert(data)
      .select('id')
      .single();

    if (error) throw error;
    this.customerCache.set(data.portal_customer_id, inserted.id);
    this.stats.imported++;
  }

  private async updateCustomer(id: string, updates: Record<string, unknown>): Promise<void> {
    if (this.options.dryRun) return;
    const { error } = await this.supabase
      .from('customers')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  }

  private async getOrCreateAccount(customerId: string): Promise<string | null> {
    // Check cache
    const cached = this.accountCache.get(customerId);
    if (cached) return cached;

    if (this.options.dryRun) {
      const id = `dry-run-account-${customerId}`;
      this.accountCache.set(customerId, id);
      return id;
    }

    // Find existing account
    const { data: accounts } = await this.supabase
      .from('customer_accounts')
      .select('id')
      .eq('customer_id', customerId)
      .eq('status', 'active')
      .limit(1);

    if (accounts && accounts.length > 0) {
      this.accountCache.set(customerId, accounts[0].id);
      return accounts[0].id;
    }

    // Create default cable account
    const { data: plan } = await this.supabase
      .from('service_plans')
      .select('id')
      .eq('organization_id', ORG_ID)
      .eq('type', 'cable')
      .eq('is_active', true)
      .limit(1);

    const { data: inserted, error } = await this.supabase
      .from('customer_accounts')
      .insert({
        customer_id: customerId,
        service_plan_id: plan?.[0]?.id || null,
        account_type: 'cable',
        status: 'active',
        auto_renew: true,
      })
      .select('id')
      .single();

    if (error) throw error;
    this.accountCache.set(customerId, inserted.id);
    return inserted.id;
  }

  private async getOrCreateBillingRecord(
    accountId: string,
    billingMonth: string,
    billAmount: Paise,
    previousBalance: Paise,
    discount: Paise
  ): Promise<string | null> {
    const cacheKey = `${accountId}|${billingMonth}`;
    const cached = this.billingCache.get(cacheKey);
    if (cached) return cached;

    if (this.options.dryRun) {
      const id = `dry-run-billing-${cacheKey}`;
      this.billingCache.set(cacheKey, id);
      return id;
    }

    // Check existing
    const { data: existing } = await this.supabase
      .from('billing_records')
      .select('id')
      .eq('customer_account_id', accountId)
      .eq('billing_month', billingMonth)
      .single();

    if (existing) {
      this.billingCache.set(cacheKey, existing.id);
      return existing.id;
    }

    // Create new
    const totalDue = calculateTotalDue(billAmount, previousBalance, discount);
    const { data: inserted, error } = await this.supabase
      .from('billing_records')
      .insert({
        organization_id: ORG_ID,
        customer_account_id: accountId,
        billing_month: billingMonth,
        bill_amount: billAmount,
        previous_balance: previousBalance,
        discount,
        bill_date: billingMonth,
        due_date: this.addDays(billingMonth, 10),
        status: 'pending',
        metadata: { source_sheet: 'import', auto_created: true },
      })
      .select('id')
      .single();

    if (error) throw error;
    this.billingCache.set(cacheKey, inserted.id);
    return inserted.id;
  }

  private async insertPaymentTransaction(data: {
    organization_id: string;
    billing_record_id: string | null;
    customer_id: string;
    employee_id: string | null;
    transaction_date: string;
    amount_paid: Paise;
    payment_mode: 'cash' | 'gpay' | 'upi' | 'bank' | 'card' | 'other';
    location: 'home' | 'office' | 'field' | null;
    collector_name: string | null;
    sub_collector: string | null;
    remarks: string | null;
    is_offline: boolean;
    sync_status: 'pending' | 'synced' | 'conflict' | 'failed';
    client_operation_id: string;
  }): Promise<void> {
    if (this.options.dryRun) return;

    const { error } = await this.supabase
      .from('payment_transactions')
      .insert(data);

    if (error) throw error;
  }

  private async insertCashbookEntry(data: {
    organization_id: string;
    employee_id: string | null;
    entry_date: string;
    category: string;
    particulars: string | null;
    credit_amount: Paise;
    debit_amount: Paise;
    running_balance: Paise;
    remarks: string | null;
    is_system_generated: boolean;
    client_operation_id: string;
  }): Promise<void> {
    if (this.options.dryRun) return;

    const { error } = await this.supabase
      .from('cashbook_entries')
      .insert(data);

    if (error) throw error;
  }

  private async upsertDailySummary(data: {
    organization_id: string;
    summary_date: string;
    opening_balance: Paise;
    collector_collection: Paise;
    income: Paise;
    expense: Paise;
    chandan_collection: Paise;
    cash_collection: Paise;
    deposit_return: Paise;
    deposit: Paise;
    commission: Paise;
    salary: Paise;
    advance: Paise;
  }): Promise<void> {
    if (this.options.dryRun) return;

    const { error } = await this.supabase
      .from('daily_summaries')
      .upsert(data, { onConflict: 'organization_id,summary_date' });

    if (error) throw error;
  }

  private async getEmployeeIdByName(name: string): Promise<string | null> {
    const normalized = name.toLowerCase().trim();
    const { data } = await this.supabase
      .from('employees')
      .select('id')
      .eq('organization_id', ORG_ID)
      .ilike('name', `%${normalized}%`)
      .limit(1);
    return data?.[0]?.id || null;
  }

  // ============================================
  // Parsing Helpers
  // ============================================

  private parseAmount(val: string | number | Date | null): number {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    if (val instanceof Date) return 0;
    const cleaned = String(val).replace(/[₹,\s]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }

  private parseExcelDate(val: string | number | Date): string {
    if (val instanceof Date) {
      return `${val.getFullYear()}-${String(val.getMonth() + 1).padStart(2, '0')}-${String(val.getDate()).padStart(2, '0')}`;
    }
    if (typeof val === 'number') {
      // Excel serial date
      const date = new Date((val - 25569) * 86400 * 1000);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }
    const parsed = parseIndianDate(String(val));
    return parsed || '';
  }

  private normalizeMobile(mobile: string | null): string | null {
    if (!mobile) return null;
    const cleaned = mobile.replace(/\D/g, '');
    if (cleaned.length === 10 && /^[6-9]/.test(cleaned)) return cleaned;
    if (cleaned.length === 12 && cleaned.startsWith('91')) {
      const ten = cleaned.slice(2);
      if (/^[6-9]/.test(ten)) return ten;
    }
    return null;
  }

  private extractLocation(address: string | null): string | null {
    if (!address) return null;
    const knownLocations = ['BC Colony', 'Janata Nagar', 'Dashratpally', 'S.R. Colony', 'W. Ashram', 'Office', 'Ashish Apt', 'Shanti Apt', 'MES', 'Darjeeling more', 'Bagchi Building'];
    for (const loc of knownLocations) {
      if (address.includes(loc)) return loc;
    }
    return null;
  }

  private parsePaymentMode(mode: string): 'cash' | 'gpay' | 'upi' | 'bank' | 'card' | 'other' {
    const lower = mode.toLowerCase().trim();
    if (lower.includes('cash')) return 'cash';
    if (lower.includes('gpay') || lower.includes('google pay')) return 'gpay';
    if (lower.includes('upi')) return 'upi';
    if (lower.includes('bank')) return 'bank';
    if (lower.includes('card')) return 'card';
    return 'other';
  }

  private parseLocation(loc: string): 'home' | 'office' | 'field' | null {
    const lower = loc.toLowerCase().trim();
    if (lower.includes('home')) return 'home';
    if (lower.includes('office')) return 'office';
    if (lower.includes('field')) return 'field';
    return null;
  }

  private parseCashbookCategory(cat: string): string {
    const lower = cat.toLowerCase().trim();
    const mapping: Record<string, string> = {
      'balance': 'balance',
      'collection': 'collection',
      'advance': 'advance',
      'deposit return': 'deposit_return',
      'deposit': 'deposit',
      'income': 'income',
      'expense': 'expense',
      'commission': 'commission',
      'salary': 'salary',
    };
    for (const [key, val] of Object.entries(mapping)) {
      if (lower.includes(key)) return val;
    }
    return 'expense'; // default
  }

  private addDays(dateStr: string, days: number): string {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private logError(row: number, sheet: string, message: string): void {
    this.stats.errors.push({ row, sheet, message });
    console.error(`   ❌ Row ${row} [${sheet}]: ${message}`);
  }

  private printSummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 IMPORT SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total rows processed: ${this.stats.total}`);
    console.log(`✅ Imported: ${this.stats.imported}`);
    console.log(`⏭️  Skipped (existing): ${this.stats.skipped}`);
    console.log(`❌ Failed: ${this.stats.failed}`);
    console.log(`⚠️  Errors: ${this.stats.errors.length}`);

    if (this.stats.errors.length > 0) {
      console.log('\n🔴 Errors:');
      for (const err of this.stats.errors.slice(0, 20)) {
        console.log(`   Row ${err.row} [${err.sheet}]: ${err.message}`);
      }
      if (this.stats.errors.length > 20) {
        console.log(`   ... and ${this.stats.errors.length - 20} more`);
      }
    }

    if (this.options.dryRun) {
      console.log('\n🔍 DRY RUN - No changes were made to the database');
    }
  }
}

// ============================================
// CLI Entry Point
// ============================================

async function main() {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      file: { type: 'string', short: 'f', default: DEFAULT_FILE },
      sheet: { type: 'string', short: 's', multiple: true },
      'dry-run': { type: 'boolean', short: 'd', default: false },
      batch: { type: 'string', short: 'b', default: '100' },
    },
    strict: true,
    allowPositionals: true,
  });

  const options: ImportOptions = {
    file: values.file,
    sheets: values.sheet,
    dryRun: values['dry-run'],
    batchSize: parseInt(values.batch, 10),
  };

  // Validate file exists
  try {
    const importer = new ExcelImporter(options);
    await importer.run();
    process.exit(options.dryRun || options.failed === 0 ? 0 : 1);
  } catch (error) {
    console.error('💥 Import failed:', error);
    process.exit(1);
  }
}

main();