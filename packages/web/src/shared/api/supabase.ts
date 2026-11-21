/**
 * Supabase Client Configuration
 * Singleton pattern for consistent client across the app
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// ============================================
// Environment Validation
// ============================================

// Support both Vite (import.meta.env) and Node (process.env) environments
function getEnv(key: string): string | undefined {
  // For Node.js/tsx environments
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  // For browser/Vite environments - use type assertion
  if (typeof globalThis !== 'undefined') {
    const g = globalThis as { importMeta?: { env?: Record<string, string> } };
    if (g.importMeta?.env) {
      return g.importMeta.env[key];
    }
  }
  return undefined;
}

const SUPABASE_URL = getEnv('VITE_SUPABASE_URL') || getEnv('SUPABASE_URL');
const SUPABASE_ANON_KEY = getEnv('VITE_SUPABASE_ANON_KEY') || getEnv('SUPABASE_ANON_KEY');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('[Supabase] Missing environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
}

// ============================================
// Client Singleton
// ============================================

let supabaseInstance: SupabaseClient<Database> | null = null;

export function getSupabaseClient(): SupabaseClient<Database> {
  if (!supabaseInstance) {
    supabaseInstance = createClient<Database>(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storageKey: 'ccn-auth-token',
      },
      db: {
        schema: 'public',
      },
      global: {
        headers: {
          'X-Client-Info': 'ccn-business-management/1.0.0',
        },
      },
    });
  }
  return supabaseInstance;
}

export function resetSupabaseClient(): void {
  supabaseInstance = null;
}

// ============================================
// Typed Database Access Helpers
// ============================================

// Get client instance (lazy initialization)
function getSb(): SupabaseClient<Database> {
  return getSupabaseClient();
}

// Table name constants for consistency
export const TABLES = {
  ORGANIZATIONS: 'organizations',
  EMPLOYEES: 'employees',
  CUSTOMERS: 'customers',
  SERVICE_PLANS: 'service_plans',
  CUSTOMER_ACCOUNTS: 'customer_accounts',
  BILLING_RECORDS: 'billing_records',
  PAYMENT_TRANSACTIONS: 'payment_transactions',
  CASHBOOK_ENTRIES: 'cashbook_entries',
  DAILY_SUMMARIES: 'daily_summaries',
  AUDIT_LOGS: 'audit_logs',
  SYNC_OPERATIONS: 'sync_operations',
  IMPORT_BATCHES: 'import_batches',
} as const;

// Type helpers for query results
type EmployeeRow = Database['public']['Tables']['employees']['Row'];

// ============================================
// Common Query Builders
// ============================================

/**
 * Get current organization ID from authenticated user's employee record
 */
export async function getCurrentOrgId(): Promise<string | null> {
  const sb = getSb();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data, error } = await sb
    .from(TABLES.EMPLOYEES)
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (error || !data) return null;
  return (data as EmployeeRow).organization_id;
}

/**
 * Get current employee record
 */
export async function getCurrentEmployee(): Promise<EmployeeRow | null> {
  const sb = getSb();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data, error } = await sb
    .from(TABLES.EMPLOYEES)
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (error) return null;
  return data as EmployeeRow;
}

/**
 * Check if current user has a specific permission
 */
export async function hasPermission(permission: keyof EmployeeRow['permissions']): Promise<boolean> {
  const employee = await getCurrentEmployee();
  if (!employee) return false;
  return employee.permissions[permission] === true;
}

/**
 * Get current user's role
 */
export async function getCurrentRole(): Promise<EmployeeRow['role'] | null> {
  const employee = await getCurrentEmployee();
  return employee?.role ?? null;
}

// ============================================
// Real-time Subscriptions
// ============================================

export function subscribeToTable<T extends keyof Database['public']['Tables']>(
  table: T,
  callback: (payload: { new: Database['public']['Tables'][T]['Row'] | null; old: Database['public']['Tables'][T]['Row'] | null; eventType: 'INSERT' | 'UPDATE' | 'DELETE' }) => void,
  filter?: { column: string; value: string }
) {
  const sb = getSb();
  const channel = sb.channel(`realtime:${table}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
        filter: filter ? `${filter.column}=eq.${filter.value}` : undefined,
      },
      (payload) => callback(payload as any)
    )
    .subscribe();

  return () => {
    sb.removeChannel(channel);
  };
}

// ============================================
// Batch Operations
// ============================================

export async function batchUpsert<T extends Record<string, unknown>>(
  table: string,
  records: T[],
  options: { onConflict?: string; chunkSize?: number } = {}
): Promise<{ error: Error | null; count: number }> {
  const sb = getSb();
  const { onConflict, chunkSize = 500 } = options;
  let totalCount = 0;

  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);
    // Use type assertion for dynamic table names
    const query = sb.from(table) as any;
    const { error, count } = await query
      .upsert(chunk as T[], { onConflict, ignoreDuplicates: false });

    if (error) {
      return { error, count: totalCount };
    }
    totalCount += count ?? chunk.length;
  }

  return { error: null, count: totalCount };
}

// ============================================
// RPC Helpers (for complex operations)
// ============================================

export async function callRPC<Args extends Record<string, unknown>, Result>(
  functionName: string,
  args: Args
): Promise<{ data: Result | null; error: Error | null }> {
  const sb = getSb();
  // Use type assertion for dynamic RPC function names
  const { data, error } = await (sb.rpc as any)(functionName, args);
  return { data: data as Result | null, error: error as Error | null };
}

// ============================================
// Storage Helpers
// ============================================

export async function uploadFile(
  bucket: string,
  path: string,
  file: Blob | File,
  options: { upsert?: boolean; contentType?: string } = {}
): Promise<{ data: { path: string } | null; error: Error | null }> {
  const sb = getSb();
  const { data, error } = await sb.storage.from(bucket).upload(path, file, options);
  return { data, error: error as Error | null };
}

export function getPublicUrl(bucket: string, path: string): string {
  const sb = getSb();
  const { data } = sb.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function downloadFile(bucket: string, path: string): Promise<Blob | null> {
  const sb = getSb();
  const { data, error } = await sb.storage.from(bucket).download(path);
  if (error) return null;
  return data;
}

// ============================================
// Auth Helpers
// ============================================

export async function signIn(email: string, password: string) {
  const sb = getSb();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  return { data, error: error as Error | null };
}

export async function signOut() {
  const sb = getSb();
  const { error } = await sb.auth.signOut();
  return { error: error as Error | null };
}

export async function getSession() {
  const sb = getSb();
  const { data, error } = await sb.auth.getSession();
  return { data, error: error as Error | null };
}

export async function getUser() {
  const sb = getSb();
  const { data, error } = await sb.auth.getUser();
  return { data, error: error as Error | null };
}

export function onAuthStateChange(callback: (event: string, session: unknown) => void) {
  const sb = getSb();
  return sb.auth.onAuthStateChange(callback);
}

// ============================================
// Export types for consumers
// ============================================

export type { SupabaseClient } from '@supabase/supabase-js';