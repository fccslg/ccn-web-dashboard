import { useState } from 'react';
import { Card, CardContent } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { formatINR, formatPortalCustomerId, toPaise } from '../shared';

const mockCustomers = [
  { id: '1', portalId: '100', name: 'Amal Sanyal', mobile: '9832433875', location: 'BC Colony', status: 'active', billAmount: toPaise(41800), due: toPaise(-3600) },
  { id: '2', portalId: '101', name: 'Amit Tamang', mobile: '9093518879', location: 'W. Ashram', status: 'active', billAmount: toPaise(25500), due: toPaise(-500) },
  { id: '3', portalId: '102', name: 'Anima Mandal', mobile: '8967924475', location: 'BC Colony', status: 'active', billAmount: toPaise(38000), due: toPaise(-3000) },
  { id: '4', portalId: '103', name: 'Anima Sarkar', mobile: '9749051999', location: 'BC Colony', status: 'active', billAmount: toPaise(40000), due: toPaise(0) },
  { id: '5', portalId: '104', name: 'Anup Saha', mobile: '7679518395', location: 'Janata Nagar', status: 'active', billAmount: toPaise(25000), due: toPaise(0) },
  { id: '6', portalId: '105', name: 'Apu Sarkar', mobile: '9832014456', location: 'Janata Nagar', status: 'active', billAmount: toPaise(38000), due: toPaise(-3000) },
  { id: '7', portalId: '107', name: 'Ashish Roy Chowdhury', mobile: '9635818483', location: 'Janata Nagar', status: 'active', billAmount: toPaise(40000), due: toPaise(0) },
  { id: '8', portalId: '108', name: 'Asit Kumar Sarkar', mobile: '9851151244', location: 'W. Ashram', status: 'active', billAmount: toPaise(25000), due: toPaise(0) },
  { id: '9', portalId: '109', name: 'Atanu Dakua', mobile: '8509734610', location: 'Dashratpally', status: 'active', billAmount: toPaise(38000), due: toPaise(-3000) },
  { id: '10', portalId: '111', name: 'Babu Ghosh I', mobile: '9933508484', location: 'Janata Nagar', status: 'active', billAmount: toPaise(38000), due: toPaise(-3000) },
];

export function Customers() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'suspended'>('all');

  const filteredCustomers = mockCustomers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.portalId.includes(search) ||
      c.mobile.includes(search);
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-500 mt-1">Manage customer records and accounts</p>
        </div>
        <Button className="w-full sm:w-auto">+ Add Customer</Button>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <Input
                placeholder="Search by name, ID, or mobile..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Customer Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b border-gray-200 bg-gray-50">
                  <th className="px-6 py-3 font-medium">ID</th>
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Mobile</th>
                  <th className="px-6 py-3 font-medium">Location</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium text-right">Bill Amount</th>
                  <th className="px-6 py-3 font-medium text-right">Due</th>
                  <th className="px-6 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900 font-mono">
                      {formatPortalCustomerId(c.portalId)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{c.name}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{c.mobile}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{c.location}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        c.status === 'active' ? 'bg-green-100 text-green-800' :
                        c.status === 'inactive' ? 'bg-gray-100 text-gray-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right font-medium">
                      {formatINR(c.billAmount)}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-medium">
                      <span className={c.due < 0 ? 'text-red-600' : c.due > 0 ? 'text-green-600' : 'text-gray-900'}>
                        {c.due < 0 ? 'Owes ' : c.due > 0 ? 'Advance ' : ''}{formatINR(Math.abs(c.due))}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <Button variant="ghost" size="sm">View</Button>
                        <Button variant="ghost" size="sm">Collect</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-500">Showing 1 to 10 of 1,247 results</p>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm" disabled>Previous</Button>
              <Button variant="outline" size="sm">Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}