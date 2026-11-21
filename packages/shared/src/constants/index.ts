/**
 * Shared Constants for CCN Business Management System
 */

import type {
  PaymentMode,
  CollectionLocation,
  CashbookCategory,
  EmployeeRole,
  AccountType,
} from '../types';

// ============================================
// Display Labels (for UI)
// ============================================

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  cash: 'Cash',
  gpay: 'GPay',
  upi: 'UPI',
  bank: 'Bank Transfer',
  card: 'Card',
  other: 'Other',
};

export const COLLECTION_LOCATION_LABELS: Record<CollectionLocation, string> = {
  home: 'Home Collection',
  office: 'Office Collection',
  field: 'Field Collection',
};

export const CASHBOOK_CATEGORY_LABELS: Record<CashbookCategory, string> = {
  balance: 'Balance',
  collection: 'Collection',
  advance: 'Advance',
  deposit_return: 'Deposit Return',
  deposit: 'Deposit',
  income: 'Income',
  expense: 'Expense',
  commission: 'Commission',
  salary: 'Salary',
};

export const EMPLOYEE_ROLE_LABELS: Record<EmployeeRole, string> = {
  owner: 'Owner',
  admin: 'Administrator',
  collector: 'Collector',
  accountant: 'Accountant',
  viewer: 'Viewer',
};

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cable: 'Cable TV',
  internet: 'Broadband',
  combo: 'Combo (Cable + Internet)',
};

// ============================================
// Cashbook Category Groups (for reporting)
// ============================================

export const CASHBOOK_INCOME_CATEGORIES: CashbookCategory[] = [
  'collection',
  'income',
  'deposit_return',
];

export const CASHBOOK_EXPENSE_CATEGORIES: CashbookCategory[] = [
  'expense',
  'commission',
  'salary',
  'advance',
  'deposit',
];

export const CASHBOOK_TRANSFER_CATEGORIES: CashbookCategory[] = [
  'advance',
  'deposit',
  'deposit_return',
];

export const CASHBOOK_SYSTEM_CATEGORIES: CashbookCategory[] = [
  'balance',
];

// ============================================
// Default Values
// ============================================

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;
export const DEFAULT_TIMEZONE = 'Asia/Kolkata';
export const DEFAULT_DATE_FORMAT = 'DD-MM-YYYY';
export const DEFAULT_CURRENCY = 'INR';
export const DEFAULT_FINANCIAL_YEAR_START = 4; // April

export const WALLET_THRESHOLDS = {
  RED_BELOW: 2000, // ₹20
  GREEN_ABOVE: 6000, // ₹60
} as const;

// ============================================
// Collector Names (from Excel data)
// ============================================

export const KNOWN_COLLECTORS = [
  'Chandan',
  'Rajib',
  'Tarun',
  'Choton',
  'Collector', // generic
  'Avoy',
] as const;

export type KnownCollector = (typeof KNOWN_COLLECTORS)[number];

// ============================================
// Location Names (from Excel data)
// ============================================

export const KNOWN_LOCATIONS = [
  'BC Colony',
  'Janata Nagar',
  'Dashratpally',
  'S.R. Colony',
  'W. Ashram',
  'Office',
  'Ashish Apt',
  'Shanti Apt',
  'MES',
  'Darjeeling more',
  'Bagchi Building',
  'Ashik Ghat Road',
  'Dashrathpally',
] as const;

export type KnownLocation = (typeof KNOWN_LOCATIONS)[number];

// ============================================
// Portal Constants
// ============================================

export const PORTAL_BASE_URL = 'https://sms.ccnsiliguri.com';
export const PORTAL_LOGIN_PATH = '/';
export const PORTAL_DASHBOARD_PATH = '/index.php/Welcome/index';

export const PORTAL_API_ENDPOINTS = {
  CUSTOMERS: '/index.php/Customeroperations/getCustomerData//',
  STBS: '/index.php/Dasreports/dasStbLocationsnewtheme_listrealtime//',
  PRODUCTS: '/index.php/Products/productlistgrid//',
  BUNDLES: '/index.php/Bundle/bundle_list_grid_newtheme//',
  SERVICE_EXTENSIONS: '/index.php/Customer/getServiceExtendableList//',
  LEDGER: '/index.php/Employee/lco_deposit_ledger_newtheme_list//',
} as const;

// ============================================
// Excel Import Constants
// ============================================

export const EXCEL_SHEET_NAMES = {
  COMBO_REF: 'Combo Ref',
  CABLE_REF: 'Cable Ref',
  INTERNET_REF: 'Internet Ref',
  MONTHLY_PREFIXES: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
} as const;

export const EXCEL_COLUMN_MAPPING = {
  // Collection Register (A-T)
  COLLECTION: {
    DATE: 'A',
    ID: 'B',
    NAME: 'C',
    ADDRESS: 'D',
    MOBILE: 'E',
    P_BAL: 'F',
    BILL: 'G',
    DISCOUNT: 'H',
    TOTAL: 'I',
    P_DATE: 'J',
    PAID: 'K',
    DUE: 'L',
    LOCATION: 'N',
    MODE: 'O',
    DONE_BY: 'P',
    HOME_COLL: 'Q',
    REMARKS: 'T',
  },
  // Cashbook (V-AC)
  CASHBOOK: {
    DATE: 'V',
    CATEGORY: 'W',
    PARTICULARS: 'X',
    CREDIT: 'Y',
    DEBIT: 'Z',
    BALANCE: 'AA',
    REMARKS: 'AB',
  },
  // Summary (Rows 1-8)
  SUMMARY: {
    MONTH_DATE: 'D1',
    COLLECTION: 'D2',
    ADVANCE: 'Z2',
    OPENING_BALANCE: 'D3',
    DEPOSIT_RETURN: 'Y3',
    DEPOSIT: 'Z3',
    NET_DEPOSIT: 'AA3',
    COLLECTOR_COLLECTION: 'D4',
    CHANDAN_COLLECTION: 'G4',
    INCOME: 'D5',
    CASH_COLLECTION: 'G5',
    EXPENSE: 'D6',
    CLOSING_BALANCE: 'D7',
  },
} as const;

// ============================================
// Regex Patterns
// ============================================

export const REGEX_PATTERNS = {
  INDIAN_MOBILE: /^[6-9]\d{9}$/,
  GSTIN: /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/,
  PAN: /^[A-Z]{5}\d{4}[A-Z]{1}$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  UUID_V4: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  DATE_YYYY_MM_DD: /^\d{4}-\d{2}-\d{2}$/,
  PORTAL_CUSTOMER_ID: /^[A-Za-z0-9]+$/, // Alphanumeric
} as const;

// ============================================
// Error Codes
// ============================================

export const ERROR_CODES = {
  // Auth
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_INSUFFICIENT_PERMISSIONS: 'AUTH_INSUFFICIENT_PERMISSIONS',

  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  VALIDATION_REQUIRED_FIELD: 'VALIDATION_REQUIRED_FIELD',
  VALIDATION_INVALID_FORMAT: 'VALIDATION_INVALID_FORMAT',
  VALIDATION_DUPLICATE: 'VALIDATION_DUPLICATE',

  // Database
  DB_CONNECTION_FAILED: 'DB_CONNECTION_FAILED',
  DB_CONSTRAINT_VIOLATION: 'DB_CONSTRAINT_VIOLATION',
  DB_RECORD_NOT_FOUND: 'DB_RECORD_NOT_FOUND',
  DB_CONFLICT: 'DB_CONFLICT',

  // Sync
  SYNC_CONFLICT: 'SYNC_CONFLICT',
  SYNC_FAILED: 'SYNC_FAILED',
  SYNC_OFFLINE: 'SYNC_OFFLINE',

  // Import
  IMPORT_VALIDATION_FAILED: 'IMPORT_VALIDATION_FAILED',
  IMPORT_DUPLICATE_DATA: 'IMPORT_DUPLICATE_DATA',
  IMPORT_RECONCILIATION_FAILED: 'IMPORT_RECONCILIATION_FAILED',

  // Portal
  PORTAL_UNREACHABLE: 'PORTAL_UNREACHABLE',
  PORTAL_LOGIN_FAILED: 'PORTAL_LOGIN_FAILED',
  PORTAL_SELECTOR_CHANGED: 'PORTAL_SELECTOR_CHANGED',

  // Generic
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

// ============================================
// Feature Flags (for gradual rollout)
// ============================================

export const FEATURE_FLAGS = {
  OFFLINE_SYNC: true,
  PORTAL_INTEGRATION: true,
  ADVANCED_REPORTS: false,
  MULTI_ORG_SUPPORT: false,
  ANDROID_WIDGET: false,
  AUTO_BILLING_GENERATION: false,
  WHATSAPP_INTEGRATION: false,
} as const;