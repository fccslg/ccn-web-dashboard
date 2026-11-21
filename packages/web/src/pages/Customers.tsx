import { useState, useRef, useCallback, useMemo } from 'react';
import { Card, CardContent } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { formatINR, formatPortalCustomerId, toPaise } from '../shared';

// Simulated large dataset
const MOCK_DATA = Array.from({ length: 1247 }).map((_, i) => ({
  id: String(i),
  portalId: String(100 + i),
  name: `Customer ${i + 1}`,
  mobile: `983200${String(i).padStart(4, '0')}`,
  location: ['BC Colony', 'Janata Nagar', 'W. Ashram'][i % 3],
  status: 'active' as const,
  billAmount: toPaise(Math.random() * 50000),
  due: toPaise(Math.random() * 10000 - 5000),
}));

export function Customers() {
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(20);
  const [sortColumn, setSortColumn] = useState<keyof typeof MOCK_DATA[0] | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Filtered data based on search
  const filtered = useMemo(() => {
    return MOCK_DATA.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.portalId.includes(search) ||
      c.mobile.includes(search)
    );
  }, [search]);

  // Sorted data based on column and direction
  const sorted = useMemo(() => {
    if (!sortColumn) return filtered;
    const sortedArr = [...filtered];
    sortedArr.sort((a, b) => {
      let aVal = a[sortColumn];
      let bVal = b[sortColumn];
      // For numeric values stored as Paise (number) or strings
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
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

  const handleSort = (col: keyof typeof MOCK_DATA[0]) => {
    if (sortColumn === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortColumn(col);
      setSortAsc(true);
    }
    // Reset visible count to start from top after sorting
    setVisibleCount(20);
  };

  const sortIndicator = (col: keyof typeof MOCK_DATA[0]) => {
    if (sortColumn !== col) return null;
    return sortAsc ? ' ▲' : ' ▼';
  };

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
                    <td className="px-6 py-4 text-sm text-gray-600">{c.mobile}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{c.location}</td>
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