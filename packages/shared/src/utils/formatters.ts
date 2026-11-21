/**
 * Formatting Utilities for CCN Business Management System
 * Indian locale conventions: INR currency, DD-MM-YYYY dates
 */

import type { Paise } from '../types';
import { toRupees } from '../types';

// ============================================
// Currency Formatting (INR)
// ============================================

/**
 * Format paise as Indian Rupees with ₹ symbol
 * Uses Indian numbering system (lakhs, crores)
 */
export function formatINR(paise: Paise, options: {
  showSymbol?: boolean;
  showDecimals?: boolean;
  compact?: boolean;
} = {}): string {
  const { showSymbol = true, showDecimals = false, compact = false } = options;
  const rupees = toRupees(paise);

  if (compact) {
    // Compact notation: ₹1.2L, ₹45K, etc.
    return formatINRCompact(rupees, showSymbol);
  }

  const formatter = new Intl.NumberFormat('en-IN', {
    style: showSymbol ? 'currency' : 'decimal',
    currency: 'INR',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  });

  return formatter.format(rupees);
}

/**
 * Compact INR formatting (K, L, Cr)
 */
export function formatINRCompact(rupees: number, showSymbol = true): string {
  const abs = Math.abs(rupees);
  const sign = rupees < 0 ? '-' : '';
  const symbol = showSymbol ? '₹' : '';

  if (abs >= 10000000) { // 1 Crore
    return `${sign}${symbol}${(abs / 10000000).toFixed(1)}Cr`;
  }
  if (abs >= 100000) { // 1 Lakh
    return `${sign}${symbol}${(abs / 100000).toFixed(1)}L`;
  }
  if (abs >= 1000) { // 1 Thousand
    return `${sign}${symbol}${(abs / 1000).toFixed(1)}K`;
  }
  return `${sign}${symbol}${abs.toLocaleString('en-IN')}`;
}

/**
 * Format paise as plain number with Indian grouping (no symbol)
 */
export function formatNumberIN(paise: Paise): string {
  return toRupees(paise).toLocaleString('en-IN');
}

/**
 * Parse INR string back to paise
 * Handles: "₹1,234", "1,234", "1.2L", "45K", "1.5Cr"
 */
export function parseINR(str: string): Paise | null {
  const cleaned = str.replace(/[₹,\s]/g, '').toUpperCase();

  // Handle compact notation
  if (cleaned.endsWith('CR')) {
    return Math.round(parseFloat(cleaned.slice(0, -2)) * 10000000 * 100) as Paise;
  }
  if (cleaned.endsWith('L')) {
    return Math.round(parseFloat(cleaned.slice(0, -1)) * 100000 * 100) as Paise;
  }
  if (cleaned.endsWith('K')) {
    return Math.round(parseFloat(cleaned.slice(0, -1)) * 1000 * 100) as Paise;
  }

  // Handle regular number (may have decimals)
  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  return Math.round(num * 100) as Paise;
}

// ============================================
// Date Formatting (Indian Convention DD-MM-YYYY)
// ============================================

/**
 * Format date as DD-MM-YYYY (Indian standard)
 */
export function formatDateIN(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'Invalid Date';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Format date as DD-MMM-YYYY (e.g., 15-Aug-2025)
 */
export function formatDateINShort(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'Invalid Date';
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleString('en-IN', { month: 'short' });
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Format date for HTML input (YYYY-MM-DD)
 */
export function formatDateForInput(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Parse Indian date (DD-MM-YYYY or DD/MM/YYYY) to YYYY-MM-DD
 */
export function parseIndianDate(dateStr: string): string | null {
  const match = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/**
 * Get month name in Indian locale
 */
export function getMonthName(month: number, locale = 'en-IN'): string {
  const date = new Date(2000, month - 1, 1);
  return date.toLocaleString(locale, { month: 'long' });
}

/**
 * Get financial year from date (April-March in India)
 */
export function getFinancialYear(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 1-12
  if (month >= 4) {
    return `${year}-${String(year + 1).slice(-2)}`; // 2025-26
  }
  return `${year - 1}-${String(year).slice(-2)}`; // 2024-25
}

/**
 * Get financial year start and end dates
 */
export function getFinancialYearRange(fy: string): { start: string; end: string } {
  // FY format: "2025-26" or "2025"
  const yearMatch = fy.match(/^(\d{4})/);
  if (!yearMatch) throw new Error('Invalid financial year format');
  const startYear = parseInt(yearMatch[1], 10);
  return {
    start: `${startYear}-04-01`,
    end: `${startYear + 1}-03-31`,
  };
}

// ============================================
// Phone Number Formatting (Indian)
// ============================================

/**
 * Format Indian mobile number: +91 XXXXX XXXXX
 */
export function formatIndianMobile(mobile: string): string {
  const cleaned = mobile.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  }
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return `+91 ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`;
  }
  return mobile; // Return as-is if can't format
}

/**
 * Normalize mobile to 10-digit string
 */
export function normalizeIndianMobile(mobile: string): string | null {
  const cleaned = mobile.replace(/\D/g, '');
  if (cleaned.length === 10 && /^[6-9]/.test(cleaned)) {
    return cleaned;
  }
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    const tenDigit = cleaned.slice(2);
    if (/^[6-9]/.test(tenDigit)) return tenDigit;
  }
  return null;
}

// ============================================
// Customer ID Formatting
// ============================================

/**
 * Format portal customer ID for display
 * Numeric IDs: padded to 6 digits (000123)
 * Alphanumeric: as-is (FCC036, rajusarkar)
 */
export function formatPortalCustomerId(id: string): string {
  const trimmed = id.trim();
  if (/^\d+$/.test(trimmed)) {
    return trimmed.padStart(6, '0');
  }
  return trimmed;
}

/**
 * Generate display name: "Name (ID)"
 */
export function formatCustomerDisplay(name: string, portalId: string): string {
  return `${name} (${formatPortalCustomerId(portalId)})`;
}

// ============================================
// Status Badge Colors (for UI)
// ============================================

export const STATUS_COLORS = {
  // Customer Status
  active: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  inactive: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' },
  suspended: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },

  // Billing Status
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
  partial: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  paid: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  overdue: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
  cancelled: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' },

  // Sync Status
  synced: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  sync_pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
  conflict: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
  failed: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },

  // Payment Mode
  cash: { bg: 'bg-green-100', text: 'text-green-800', icon: '💵' },
  gpay: { bg: 'bg-blue-100', text: 'text-blue-800', icon: '📱' },
  upi: { bg: 'bg-purple-100', text: 'text-purple-800', icon: '📲' },
  bank: { bg: 'bg-indigo-100', text: 'text-indigo-800', icon: '🏦' },
  card: { bg: 'bg-pink-100', text: 'text-pink-800', icon: '💳' },
  other: { bg: 'bg-gray-100', text: 'text-gray-800', icon: '❓' },
} as const;

// ============================================
// Wallet Balance Color (from extension config)
// ============================================

export function getWalletColor(balance: Paise, redBelow = 2000, greenAbove = 6000): 'red' | 'green' | 'amber' {
  const rupees = toRupees(balance);
  if (rupees < redBelow / 100) return 'red';
  if (rupees > greenAbove / 100) return 'green';
  return 'amber';
}

// ============================================
// Number to Words (Indian)
// ============================================

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const TEENS = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function convertHundreds(num: number): string {
  if (num === 0) return '';
  if (num < 10) return ONES[num];
  if (num < 20) return TEENS[num - 10];
  if (num < 100) return TENS[Math.floor(num / 10)] + (num % 10 ? ' ' + ONES[num % 10] : '');
  return ONES[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' ' + convertHundreds(num % 100) : '');
}

export function numberToWordsINR(paise: Paise): string {
  const rupees = toRupees(paise);
  if (rupees === 0) return 'Zero Rupees Only';

  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const hundred = rupees % 1000;

  const parts: string[] = [];

  if (crore) parts.push(convertHundreds(crore) + ' Crore');
  if (lakh) parts.push(convertHundreds(lakh) + ' Lakh');
  if (thousand) parts.push(convertHundreds(thousand) + ' Thousand');
  if (hundred) parts.push(convertHundreds(hundred));

  return parts.join(' ') + ' Rupees Only';
}

// ============================================
// Relative Time Formatting
// ============================================

export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

// ============================================
// Collection Summary Formatting
// ============================================

export interface CollectionSummary {
  totalCustomers: number;
  totalBilled: Paise;
  totalCollected: Paise;
  totalOutstanding: Paise;
  totalAdvance: Paise;
  collectionRate: number; // 0-100
}

export function formatCollectionSummary(summary: CollectionSummary): string {
  return `
Total Customers: ${summary.totalCustomers}
Total Billed: ${formatINR(summary.totalBilled)}
Total Collected: ${formatINR(summary.totalCollected)}
Outstanding: ${formatINR(summary.totalOutstanding)}
Advance: ${formatINR(summary.totalAdvance)}
Collection Rate: ${summary.collectionRate.toFixed(1)}%
  `.trim();
}