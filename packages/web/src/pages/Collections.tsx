import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { formatINR, formatDateIN, formatDateForInput, toPaise } from '../shared';

const mockCollections = [
  { id: '1', date: '2025-08-01', customer: 'Bikash Mallik', customerId: '100', amount: toPaise(45000), mode: 'Cash', collector: 'Chandan', location: 'Home', status: 'synced' },
  { id: '2', date: '2025-08-01', customer: 'Sampa Das', customerId: 'FCC036', amount: toPaise(54000), mode: 'GPay', collector: 'Tarun', location: 'Home', status: 'synced' },
  { id: '3', date: '2025-08-01', customer: 'Raju Sarkar', customerId: 'rajusarkar', amount: toPaise(105000), mode: 'GPay', collector: 'Tarun', location: 'Home', status: 'synced' },
  { id: '4', date: '2025-08-01', customer: 'Akash Poddar', customerId: '262', amount: toPaise(38000), mode: 'Cash', collector: 'Chandan', location: 'Home', status: 'synced' },
  { id: '5', date: '2025-08-01', customer: 'Babu Ghosh II', customerId: '704', amount: toPaise(60000), mode: 'GPay', collector: 'Tarun', location: 'Home', status: 'synced' },
];

export function Collections() {
  const [dateFrom, setDateFrom] = useState(formatDateForInput(new Date()));
  const [dateTo, setDateTo] = useState(formatDateForInput(new Date()));
  const [collectorFilter, setCollectorFilter] = useState('');
  const [modeFilter, setModeFilter] = useState('');
  const [showForm, setShowForm] = useState(false);

  const totalAmount = mockCollections.reduce((sum, c) => sum + c.amount, 0);
  const cashAmount = mockCollections.filter(c => c.mode === 'Cash').reduce((sum, c) => sum + c.amount, 0);
  const digitalAmount = totalAmount - cashAmount;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Submit collection
    setShowForm(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Collections</h1>
          <p className="text-gray-500 mt-1">Record and manage customer payments</p>
        </div>
        <Button onClick={() => setShowForm(true)}>+ New Collection</Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Collected</p>
                <p className="text-2xl font-bold text-gray-900">{formatINR(totalAmount)}</p>
              </div>
              <div className="text-3xl">💰</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Cash Collections</p>
                <p className="text-2xl font-bold text-green-600">{formatINR(cashAmount)}</p>
              </div>
              <div className="text-3xl">💵</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Digital Payments</p>
                <p className="text-2xl font-bold text-blue-600">{formatINR(digitalAmount)}</p>
              </div>
              <div className="text-3xl">📱</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* New Collection Form */}
      {showForm && (
        <Card className="animate-slide-in">
          <CardHeader>
            <CardTitle>New Collection Entry</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer ID / Name</label>
                  <Input placeholder="Search customer..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                  <Input type="number" placeholder="0" step="1" min="1" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode</label>
                  <Select>
                    <option value="cash">Cash</option>
                    <option value="gpay">GPay</option>
                    <option value="upi">UPI</option>
                    <option value="bank">Bank Transfer</option>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Collector</label>
                  <Select>
                    <option value="Chandan">Chandan</option>
                    <option value="Rajib">Rajib</option>
                    <option value="Tarun">Tarun</option>
                    <option value="Choton">Choton</option>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <Select>
                    <option value="home">Home</option>
                    <option value="office">Office</option>
                    <option value="field">Field</option>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Billing Month</label>
                  <Input type="month" />
                </div>
                <div className="md:col-span-2 lg:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                  <Input placeholder="Optional remarks..." />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit">Save Collection</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Collector</label>
              <Select value={collectorFilter} onChange={e => setCollectorFilter(e.target.value)}>
                <option value="">All Collectors</option>
                <option value="Chandan">Chandan</option>
                <option value="Rajib">Rajib</option>
                <option value="Tarun">Tarun</option>
                <option value="Choton">Choton</option>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mode</label>
              <Select value={modeFilter} onChange={e => setModeFilter(e.target.value)}>
                <option value="">All Modes</option>
                <option value="Cash">Cash</option>
                <option value="GPay">GPay</option>
                <option value="UPI">UPI</option>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Collections Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b border-gray-200 bg-gray-50">
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium">Customer</th>
                  <th className="px-6 py-3 font-medium">ID</th>
                  <th className="px-6 py-3 font-medium text-right">Amount</th>
                  <th className="px-6 py-3 font-medium">Mode</th>
                  <th className="px-6 py-3 font-medium">Collector</th>
                  <th className="px-6 py-3 font-medium">Location</th>
                  <th className="px-6 py-3 font-medium">Sync</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {mockCollections.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{formatDateIN(c.date)}</td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{c.customer}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-mono">{c.customerId}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right font-medium">{formatINR(c.amount)}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        c.mode === 'Cash' ? 'bg-green-100 text-green-800' :
                        c.mode === 'GPay' ? 'bg-blue-100 text-blue-800' :
                        c.mode === 'UPI' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {c.mode}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{c.collector}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 capitalize">{c.location}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        c.status === 'synced' ? 'bg-green-100 text-green-800' :
                        c.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {c.status}
                      </span>
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