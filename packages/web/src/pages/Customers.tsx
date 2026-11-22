import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { formatINR, formatPortalCustomerId, type Paise } from '../shared';
import { getSupabaseClient } from '../shared/api/supabase';
import { useAuth } from '../hooks/useAuth';
import type { Database } from '../shared/api/database.types';

function downloadSampleExcel() {
  const headers = [
    'LCOID',
    'Name',
    'Mobile',
    'Address',
    'Cable Serial',
    'Cable VC',
    'Internet ID'
  ];

  const sampleData = [
    ['100', 'Amal Sanyal', '9832433875', 'BC Colony, Siliguri', 'STB12345', 'VC67890', 'INT001'],
    ['101', 'Amit Tamang', '9093518879', 'W. Ashram, Siliguri', 'STB12346', 'VC67891', 'INT002'],
    ['102', 'Anima Mandal', '8967924475', 'BC Colony, Siliguri', 'STB12347', 'VC67892', 'INT003'],
    ['103', 'Anima Sarkar', '9749051999', 'BC Colony, Siliguri', 'STB12348', 'VC67893', 'INT004'],
    ['104', 'Anup Saha', '7679518395', 'Janata Nagar, Siliguri', 'STB12349', 'VC67894', 'INT005'],
    ['105', 'Apu Sarkar', '9832014456', 'Janata Nagar, Siliguri', 'STB12350', 'VC67895', 'INT006'],
    ['107', 'Ashish Roy Chowdhury', '9635818483', 'Janata Nagar, Siliguri', 'STB12351', 'VC67896', 'INT007'],
    ['108', 'Asit Kumar Sarkar', '9851151244', 'W. Ashram, Siliguri', 'STB12352', 'VC67897', 'INT008'],
    ['109', 'Atanu Dakua', '8509734610', 'Dashratpally, Siliguri', 'STB12353', 'VC67898', 'INT009'],
    ['111', 'Babu Ghosh I', '9933508484', 'Janata Nagar, Siliguri', 'STB12354', 'VC67899', 'INT010'],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Customers');
  XLSX.writeFile(wb, 'Customer_Import_Template.xlsx');
}

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

interface ImportPreview {
  portalId: string;
  name: string;
  mobile: string | null;
  location: string | null;
  address: string | null;
  cableRefId: string | null;
  internetRefId: string | null;
  status: string;
  isValid: boolean;
  error?: string;
}

export function Customers() {
  // DEBUG: Simple log to verify component execution
  console.log('Customers component rendering v11');

  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(20);
  const [sortColumn, setSortColumn] = useState<keyof CustomerWithDue | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allCustomers, setAllCustomers] = useState<CustomerWithDue[]>([]);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview[]>([]);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importDropdownOpen, setImportDropdownOpen] = useState(false);
  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Add Customer modal state
  const [addCustomerModalOpen, setAddCustomerModalOpen] = useState(false);
  const [newCustomerPortalId, setNewCustomerPortalId] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerMobile, setNewCustomerMobile] = useState('');
  const [newCustomerAddress, setNewCustomerAddress] = useState('');
  const [newCustomerLocation, setNewCustomerLocation] = useState('');
  const [newCustomerCableRefId, setNewCustomerCableRefId] = useState('');
  const [newCustomerInternetRefId, setNewCustomerInternetRefId] = useState('');
  const [addCustomerLoading, setAddCustomerLoading] = useState(false);
  const [addCustomerError, setAddCustomerError] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { currentOrg } = useAuth();

  // DEBUG: Log every render with state values
  useEffect(() => {
    console.log('Customers rendered, addCustomerModalOpen:', addCustomerModalOpen, 'importModalOpen:', importModalOpen);
  }, [addCustomerModalOpen, importModalOpen]);

  // Fetch customers from Supabase
  useEffect(() => {
    async function fetchCustomers() {
      if (!currentOrg) {
        setError('No organization selected');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const sb = getSupabaseClient();

        // Fetch all customers for this organization
        const { data: customers, error: custError } = await sb
          .from('customers')
          .select('id, portal_customer_id, name, mobile, location, status')
          .eq('organization_id', currentOrg.organization.id)
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
  }, [currentOrg]);

  // Handle file change for import
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        // Assume first sheet is the customer data
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

        if (jsonData.length < 2) {
          setImportError('File appears to be empty or has no data rows');
          return;
        }

        // Expected headers: LCOID, Name, Mobile, Address, Cable Serial, Cable VC, Internet ID
        const rows = jsonData.slice(1) as (string | number | null)[][];

        const preview: ImportPreview[] = rows.map((row) => {
          const portalId = normalizePortalId(String(row[0] || ''));
          const name = String(row[1] || '').trim();
          const mobile = String(row[2] || '').trim() || null;
          const address = String(row[3] || '').trim() || null;
          const cableRefId = String(row[4] || '').trim() || null;
          const vcNumber = String(row[5] || '').trim() || null;
          const internetRefId = String(row[6] || '').trim() || null;

          const isValid = !!portalId && !!name;
          let error = '';
          if (!portalId) error += 'Missing LCOID; ';
          if (!name) error += 'Missing Name; ';

          return {
            portalId,
            name,
            mobile,
            location: extractLocation(address),
            address,
            cableRefId: cableRefId || (vcNumber ? `VC:${vcNumber}` : null),
            internetRefId,
            status: 'active',
            isValid,
            error: error || undefined,
          };
        });

        setImportPreview(preview);
        setImportError(null);
        setImportModalOpen(true);
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'Failed to parse Excel file');
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset input
    e.target.value = '';
  };

  const normalizePortalId = (id: string): string => {
    const cleaned = id.replace(/\D/g, '');
    return cleaned || '';
  };

  const extractLocation = (address: string | null): string | null => {
    if (!address) return null;
    const knownLocations = ['BC Colony', 'Janata Nagar', 'W. Ashram', 'Dashratpally', 'S.R. Colony', 'Office', 'Ashish Apt', 'Shanti Apt', 'MES', 'Darjeeling more', 'Bagchi Building'];
    for (const loc of knownLocations) {
      if (address.includes(loc)) return loc;
    }
    return null;
  };

  const handleImportConfirm = async () => {
    const validRows = importPreview.filter(r => r.isValid);
    if (validRows.length === 0) {
      setImportError('No valid rows to import');
      return;
    }

    if (!currentOrg) {
      setImportError('No organization selected');
      return;
    }

    setImporting(true);
    setImportError(null);

    try {
      const sb = getSupabaseClient();
      const orgId = currentOrg.organization.id;

      let imported = 0;
      let skipped = 0;

      for (const row of validRows) {
        // Check if customer already exists
        const { data: existing } = await sb
          .from('customers')
          .select('id')
          .eq('organization_id', orgId)
          .eq('portal_customer_id', row.portalId)
          .single();

        if (existing) {
          skipped++;
          continue;
        }

        // Insert new customer
        const { error } = await sb
          .from('customers')
          .insert({
            organization_id: orgId,
            portal_customer_id: row.portalId,
            name: row.name,
            mobile: row.mobile,
            address: row.address,
            location: row.location,
            cable_ref_id: row.cableRefId,
            internet_ref_id: row.internetRefId,
            status: row.status as 'active',
            metadata: {},
          } as any);

        if (error) {
          console.error('Import error for', row.portalId, error);
        } else {
          imported++;
        }
      }

      // Refresh customer list
      const { data: customers } = await sb
        .from('customers')
        .select('id, portal_customer_id, name, mobile, location, status')
        .eq('organization_id', orgId)
        .eq('status', 'active')
        .order('portal_customer_id', { ascending: true });

      // Recalculate dues for refreshed list
      const customersWithDue: CustomerWithDue[] = [];
      for (const cust of (customers as CustomerRow[]) || []) {
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
      setImportModalOpen(false);
      setImportPreview([]);
      setImportError(`Imported ${imported} customers, skipped ${skipped} duplicates`);

      // Clear error after 5 seconds
      setTimeout(() => setImportError(null), 5000);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

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

  const handleAddCustomer = async () => {
    if (!newCustomerName || !newCustomerPortalId) {
      setAddCustomerError('Name and Portal ID are required');
      return;
    }

    if (!currentOrg) {
      setAddCustomerError('No organization selected');
      return;
    }

    setAddCustomerLoading(true);
    setAddCustomerError(null);

    try {
      const sb = getSupabaseClient();
      const orgId = currentOrg.organization.id;

      // Check if portal ID already exists for this org
      const { data: existing } = await sb
        .from('customers')
        .select('id')
        .eq('organization_id', orgId)
        .eq('portal_customer_id', newCustomerPortalId.trim().toUpperCase())
        .single();

      if (existing) {
        setAddCustomerError('Customer with this ID already exists');
        return;
      }

      // Create the customer
      await sb.from('customers').insert({
        organization_id: orgId,
        portal_customer_id: newCustomerPortalId.trim().toUpperCase(),
        name: newCustomerName.trim(),
        mobile: newCustomerMobile.trim() || null,
        address: newCustomerAddress.trim() || null,
        location: newCustomerLocation.trim() || null,
        cable_ref_id: newCustomerCableRefId.trim() || null,
        internet_ref_id: newCustomerInternetRefId.trim() || null,
        status: 'active',
        metadata: {},
      } as any);

      // Refresh customer list
      const { data: customers } = await sb
        .from('customers')
        .select('id, portal_customer_id, name, mobile, location, status')
        .eq('organization_id', orgId)
        .eq('status', 'active')
        .order('portal_customer_id', { ascending: true });

      // Recalculate dues for refreshed list
      const customersWithDue: CustomerWithDue[] = [];
      for (const cust of (customers as CustomerRow[]) || []) {
        const { data: accounts } = await sb
          .from('customer_accounts')
          .select('id')
          .eq('customer_id', cust.id)
          .eq('status', 'active')
          .limit(1);

        let due: Paise = 0;

        if (accounts && accounts.length > 0) {
          const accountId = accounts[0] as any;
          const { data: billingRecords } = await sb
            .from('billing_records')
            .select('total_due')
            .eq('customer_account_id', accountId.id)
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
      setAddCustomerModalOpen(false);
      setNewCustomerPortalId('');
      setNewCustomerName('');
      setNewCustomerMobile('');
      setNewCustomerAddress('');
      setNewCustomerLocation('');
      setNewCustomerCableRefId('');
      setNewCustomerInternetRefId('');
    } catch (err: any) {
      setAddCustomerError(err?.message || 'Failed to create customer');
    } finally {
      setAddCustomerLoading(false);
    }
  };

  const downloadSelectedReport = () => {
    const selected = sorted.filter(c => selectedIds.has(c.id));
    if (selected.length === 0) return;

    const headers = ['LCOID', 'Name', 'Mobile', 'Location', 'Status', 'Due Amount'];
    const rows = selected.map(c => [
      c.portalId,
      c.name,
      c.mobile || '',
      c.location || '',
      c.status,
      formatINR(c.due),
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Customer Report');
    XLSX.writeFile(wb, `Customer_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    setSelectedIds(new Set());
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletePassword) {
      setDeleteError('Enter owner password');
      return;
    }
    // In production, verify via Supabase RPC
    // if (deletePassword !== OWNER_PASSWORD) { setDeleteError('Incorrect password'); return; }

    if (!currentOrg) {
      setDeleteError('No organization selected');
      return;
    }

    setDeleting(true);
    setDeleteError(null);

    try {
      const sb = getSupabaseClient();
      const orgId = currentOrg.organization.id;

      const idsToDelete = Array.from(selectedIds);
      for (const id of idsToDelete) {
        await sb.from('customers').delete().eq('id', id).eq('organization_id', orgId);
      }

      // Refresh
      const { data: customers } = await sb
        .from('customers')
        .select('id, portal_customer_id, name, mobile, location, status')
        .eq('organization_id', orgId)
        .eq('status', 'active')
        .order('portal_customer_id', { ascending: true });

      const customersWithDue: CustomerWithDue[] = [];
      for (const cust of (customers as CustomerRow[]) || []) {
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
      setSelectedIds(new Set());
      setDeleteModalOpen(false);
      setDeletePassword('');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
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

  // Empty state - still show the table with modal
  if (sorted.length === 0 && !addCustomerModalOpen) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
            <p className="text-gray-500 mt-1">No customers found</p>
          </div>
        </div>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-4xl mb-2">👥</div>
            <h3 className="font-semibold text-gray-900 mb-2">No customers yet</h3>
            <p className="text-gray-500 mb-4">Add your first customer to get started</p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => setAddCustomerModalOpen(true)} className="w-full sm:w-auto">+ Add Customer</Button>
              <Button variant="outline" onClick={() => setImportDropdownOpen(true)}>
                📥 Import Excel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Selection handlers (defined after visibleCustomers)
  const isAllSelected = visibleCustomers.length > 0 && visibleCustomers.every(c => selectedIds.has(c.id));
  // const isIndeterminate = visibleCustomers.some(c => selectedIds.has(c.id)) && !isAllSelected;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      visibleCustomers.forEach(c => selectedIds.delete(c.id));
    } else {
      visibleCustomers.forEach(c => selectedIds.add(c.id));
    }
    setSelectedIds(new Set(selectedIds));
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  return (
    <div className="space-y-6">
      {/* DEBUG: Show modal state - inline at top */}
      <div className="mb-4 p-4 bg-yellow-100 border border-yellow-400 rounded text-sm font-mono">
        <div>Add Customer Modal: {addCustomerModalOpen ? 'OPEN' : 'CLOSED'}</div>
        <div>Import Modal: {importModalOpen ? 'OPEN' : 'CLOSED'}</div>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-500 mt-1">Showing {visibleCustomers.length} of {sorted.length} results</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button onClick={() => setAddCustomerModalOpen(true)} className="w-full sm:w-auto">+ Add Customer</Button>
          {selectedIds.size > 0 && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={downloadSelectedReport}>
                📊 Download Report
              </Button>
              <Button variant="outline" className="text-red-600 hover:bg-red-50" onClick={handleDeleteSelected}>
                🗑️ Delete ({selectedIds.size})
              </Button>
            </div>
          )}
          <div className="relative">
            <Button variant="outline" onClick={() => setImportDropdownOpen(!importDropdownOpen)}>
              📥 Import Excel
              <svg className="ml-1 w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </Button>
            {importDropdownOpen && (
              <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-[60] py-1">
                <button
                  onClick={() => { downloadSampleExcel(); setImportDropdownOpen(false); }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                >
                  <span className="w-5 h-5">📥</span>
                  Download Template
                </button>
                <hr className="my-1 border-gray-200" />
                <label className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 cursor-pointer">
                  <span className="w-5 h-5">📤</span>
                  Import File
                  <input
                    id="import-file-input"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => { handleFileChange(e); setImportDropdownOpen(false); }}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>
        </div>
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
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                  </th>
                  <th className="px-6 py-3 font-medium cursor-pointer" onClick={() => handleSort('portalId')}>ID{sortIndicator('portalId')}</th>
                  <th className="px-6 py-3 font-medium cursor-pointer" onClick={() => handleSort('name')}>Name{sortIndicator('name')}</th>
                  <th className="px-6 py-3 font-medium cursor-pointer" onClick={() => handleSort('mobile')}>Mobile{sortIndicator('mobile')}</th>
                  <th className="px-6 py-3 font-medium cursor-pointer" onClick={() => handleSort('location')}>Location{sortIndicator('location')}</th>
                  <th className="px-6 py-3 font-medium text-right cursor-pointer" onClick={() => handleSort('due')}>Due{sortIndicator('due')}</th>
                  <th className="px-6 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleCustomers.map((c, index) => (
                  <tr
                    key={c.id}
                    ref={index === visibleCustomers.length - 1 ? lastElementRef : null}
                    className={`hover:bg-gray-50 ${selectedIds.has(c.id) ? 'bg-indigo-50' : ''}`}
                  >
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(c.id)}
                        onChange={() => toggleSelect(c.id)}
                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-6 py-4 text-sm font-mono">{formatPortalCustomerId(c.portalId)}</td>
                    <td className="px-6 py-4 font-medium">{c.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{c.mobile || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{c.location || '-'}</td>
                    <td className={`px-6 py-4 text-sm text-right font-medium ${c.due < 0 ? 'text-red-600' : c.due > 0 ? 'text-green-600' : 'text-gray-900'}`}>
                      {formatINR(Math.abs(c.due))}
                    </td>
                    <td className="px-6 py-4"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Import Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 z-[60] overflow-y-auto" style={{ outline: '3px solid blue', outlineOffset: '-3px', backgroundColor: 'rgba(0,0,255,0.1)' }}>
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setImportModalOpen(false)} />
            <Card className="relative w-full max-w-3xl max-h-[80vh] overflow-hidden">
              <CardHeader className="border-b border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <CardTitle>Import Customers from Excel</CardTitle>
                  <button onClick={() => { setImportModalOpen(false); setImportPreview([]); setImportError(null); }} className="p-1 hover:bg-gray-100 rounded">
                    ✕
                  </button>
                </div>
              </CardHeader>
              <CardContent className="p-4 overflow-y-auto max-h-[60vh]">
                {importError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                    {importError}
                  </div>
                )}

                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">
                    Preview ({importPreview.filter(r => r.isValid).length} valid, {importPreview.filter(r => !r.isValid).length} invalid)
                  </p>
                  <div className="overflow-x-auto max-h-96">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b border-gray-200 sticky top-0 bg-white">
                          <th className="px-3 py-2 font-medium">LCOID</th>
                          <th className="px-3 py-2 font-medium">Name</th>
                          <th className="px-3 py-2 font-medium">Mobile</th>
                          <th className="px-3 py-2 font-medium">Location</th>
                          <th className="px-3 py-2 font-medium">Cable Ref</th>
                          <th className="px-3 py-2 font-medium">Internet Ref</th>
                          <th className="px-3 py-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {importPreview.map((row, idx) => (
                          <tr key={idx} className={row.isValid ? '' : 'bg-red-50'}>
                            <td className="px-3 py-2 font-mono">{row.portalId || '-'}</td>
                            <td className="px-3 py-2 font-medium">{row.name}</td>
                            <td className="px-3 py-2 text-gray-600">{row.mobile || '-'}</td>
                            <td className="px-3 py-2 text-gray-600">{row.location || '-'}</td>
                            <td className="px-3 py-2 text-gray-600">{row.cableRefId || '-'}</td>
                            <td className="px-3 py-2 text-gray-600">{row.internetRefId || '-'}</td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                                row.isValid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {row.isValid ? 'Valid' : row.error}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
                  <Button variant="outline" onClick={() => { setImportModalOpen(false); setImportPreview([]); setImportError(null); }}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleImportConfirm}
                    disabled={importing || importPreview.filter(r => r.isValid).length === 0}
                  >
                    {importing ? 'Importing...' : `Import ${importPreview.filter(r => r.isValid).length} Customers`}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => { setDeleteModalOpen(false); setDeletePassword(''); setDeleteError(null); }} />
            <Card className="relative w-full max-w-md">
              <CardHeader className="border-b border-gray-200 p-4 bg-red-50">
                <CardTitle className="text-red-600 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Confirm Deletion
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <p className="mb-4">
                  Are you sure you want to permanently delete <strong>{selectedIds.size} customer(s)</strong>?
                  This action cannot be undone.
                </p>
                {deleteError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                    {deleteError}
                  </div>
                )}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Owner Password (required)
                  </label>
                  <Input
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Enter owner password"
                    autoFocus
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => { setDeleteModalOpen(false); setDeletePassword(''); setDeleteError(null); }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={confirmDelete}
                    disabled={deleting}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {deleting ? 'Deleting...' : `Delete ${selectedIds.size} Customer(s) Permanently`}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      </div>
  );
}
// rebuild: Sun, Nov 22, 2026 12:54:26 AM
