import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Card, CardContent } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { formatINR, formatPortalCustomerId, type Paise } from '../shared';
import { getSupabaseClient, getCurrentOrgId } from '../shared/api/supabase';
import type { Database } from '../shared/api/database.types';

type CustomerRow = Database['public']['Tables']['customers']['Row'];
type BillingRecordRow = Database['public']['Tables']['billing_records']['Row'];

interface CustomerWithDue {
  id: string;
  portalId: string;
  name: string;
  mobile: string | null;
  location: string | null;
  status: string;
  due: Paise;
}

export function Customers() {
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(20);
  const [sortColumn, setSortColumn] = useState<keyof CustomerWithDue | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allCustomers, setAllCustomers] = useState<CustomerWithDue[]>([]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Fetch customers from Supabase
  useEffect(() => {
    async function fetchCustomers() {
      try {
        setLoading(true);
        const sb = getSupabaseClient();

        // Get organization ID
        const orgId = await getCurrentOrgId();
        if (!orgId) {
          throw new Error('No organization found for current user');
        }

        // Fetch all customers for this organization
        const { data: customers, error: custError } = await sb
          .from('customers')
          .select('id, portal_customer_id, name, mobile, location, status')
          .eq('organization_id', orgId)
          .eq('status', 'active')
          .order('portal_customer_id', { ascending: true });

        if (custError) throw custError;

        // For each customer, get their active account and latest billing record
        // to calculate current due
        const customersWithDue: CustomerWithDue[] = [];

        for (const cust of (customers as CustomerRow[]) || []) {
          // Get customer's active account
          const { data: accounts } = await sb
            .from('customer_accounts')
            .select('id')
            .eq('customer_id', cust.id)
            .eq('status', 'active')
            .limit(1);

          type AccountRow = { id: string };
          let due: Paise = 0;

          if (accounts && accounts.length > 0) {
            const accountId = (accounts[0] as AccountRow).id;

            // Get latest billing record for this account
            const { data: billingRecords } = await sb
              .from('billing_records')
              .select('total_due')
              .eq('customer_account_id', accountId)
              .order('billing_month', { ascending: false })
              .limit(1);

            if (billingRecords && billingRecords.length > 0) {
              due = (billingRecords[0] as BillingRecordRow).total_due as Paise ?? 0;
            }
          }

          customersWithDue.push({
            id: cust.id,
            portalId: cust.portal_customer_id,
            name: cust.name,
            mobile: cust.mobile,
            location: cust.location,
            status: cust.status,
            due,
          });
        }

        setAllCustomers(customersWithDue);
      } catch (err) {
        console.error('Failed to fetch customers:', err);
        setError(err instanceof Error ? err.message : 'Failed to load customers');
      } finally {
        setLoading(false);
      }
    }

    fetchCustomers();
  }, []);

  // Filtered data based on search
  const filtered = useMemo(() => {
    if (!search) return allCustomers;
    const lowerSearch = search.toLowerCase();
    return allCustomers.filter(c =>
      c.name.toLowerCase().includes(lowerSearch) ||
      c.portalId.includes(search) ||
      c.mobile?.includes(search)
    );
  }, [search, allCustomers]);

  // Sorted data based on column and direction
  const sorted = useMemo(() => {
    if (!sortColumn) return filtered;
    const sortedArr = [...filtered];
    sortedArr.sort((a, b) => {
      const aVal = a[sortColumn] ?? '';
      const bVal = b[sortColumn] ?? '';
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const aLower = aVal.toLowerCase();
        const bLower = bVal.toLowerCase();
        if (aLower < bLower) return sortAsc ? -1 : 1;
        if (aLower > bLower) return sortAsc ? 1 : -1;
        return 0;
      }
      if (aVal < bVal) return sortAsc ? -1 : 1;
      if (aVal > bVal) return sortAsc ? 1 : -1;
      return 0;
    });
    return sortedArr;
  }, [filtered, sortColumn, sortAsc]);

  const visibleCustomers = sorted.slice(0, visibleCount);

  // Intersection Observer for Infinite Scroll
  const observer = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useCallback((node: HTMLTableRowElement | null) => {
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && visibleCount < sorted.length) {
        setVisibleCount(prev => prev + 20);
      }
    });
    if (node) observer.current.observe(node);
  }, [visibleCount, sorted.length]);

  const handleSort = (col: keyof CustomerWithDue) => {
    if (sortColumn === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortColumn(col);
      setSortAsc(true);
    }
    // Reset visible count to start from top after sorting
    setVisibleCount(20);
  };

  const sortIndicator = (col: keyof CustomerWithDue) => {
    if (sortColumn !== col) return null;
    return sortAsc ? ' ▲' : ' ▼';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
            <p className="text-gray-500 mt-1">Loading customers...</p>
          </div>
        </div>
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
        </div>
        <Card className="border-red-200">
          <CardContent className="p-6 text-center text-red-600">
            <p className="font-medium">Failed to load customers</p>
            <p className="text-sm mt-2">{error}</p>
            <Button onClick={() => window.location.reload()} className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-500 mt-1">Showing {visibleCustomers.length} of {sorted.length} results</p>
        </div>
        <Button className="w-full sm:w-auto">+ Add Customer</Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <Input
            placeholder="Search through all customers by name, ID, or mobile..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setVisibleCount(20); }}
            className="w-full"
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto h-[600px] overflow-y-auto" ref={scrollContainerRef}>
            <table className="w-full">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
                  <th className="px-6 py-3 font-medium cursor-pointer" onClick={() => handleSort('portalId')}>ID{sortIndicator('portalId')}</th>
                  <th className="px-6 py-3 font-medium cursor-pointer" onClick={() => handleSort('name')}>Name{sortIndicator('name')}</th>
                  <th className="px-6 py-3 font-medium cursor-pointer" onClick={() => handleSort('mobile')}>Mobile{sortIndicator('mobile')}</th>
                  <th className="px-6 py-3 font-medium cursor-pointer" onClick={() => handleSort('location')}>Location{sortIndicator('location')}</th>
                  <th className="px-6 py-3 font-medium text-right cursor-pointer" onClick={() => handleSort('due')}>Due{sortIndicator('due')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleCustomers.map((c, index) => (
                  <tr
                    key={c.id}
                    ref={index === visibleCustomers.length - 1 ? lastElementRef : null}
                    className="hover:bg-gray-50"
                  >
                    <td className="px-6 py-4 text-sm font-mono">{formatPortalCustomerId(c.portalId)}</td>
                    <td className="px-6 py-4 font-medium">{c.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{c.mobile || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{c.location || '-'}</td>
                    <td className="px-6 py-4 text-sm text-right font-medium {c.due < 0 ? 'text-red-600' : c.due > 0 ? 'text-green-600' : 'text-gray-900'}">
                      {formatINR(Math.abs(c.due))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}