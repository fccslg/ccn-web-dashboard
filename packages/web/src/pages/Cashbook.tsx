import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { formatINR, formatDateIN, formatDateForInput, toPaise } from '../shared';

const mockCashbook = [
  { id: '1', date: '2025-08-01', category: 'balance', particulars: 'Opening Balance', credit: toPaise(0), debit: toPaise(0), balance: toPaise(59200), system: true },
  { id: '2', date: '2025-08-01', category: 'collection', particulars: 'Chandan Collection', credit: toPaise(173000), debit: toPaise(0), balance: toPaise(232200), system: false },
  { id: '3', date: '2025-08-01', category: 'collection', particulars: 'Office Cash Collected', credit: toPaise(0), debit: toPaise(0), balance: toPaise(232200), system: false },
  { id: '4', date: '2025-08-01', category: 'expense', particulars: 'Barun Da', credit: toPaise(0), debit: toPaise(2000), balance: toPaise(230200), system: false },
  { id: '5', date: '2025-08-01', category: 'expense', particulars: 'Barun Da', credit: toPaise(0), debit: toPaise(1000), balance: toPaise(229200), system: false },
  { id: '6', date: '2025-08-01', category: 'expense', particulars: 'Barun Da', credit: toPaise(0), debit: toPaise(5000), balance: toPaise(224200), system: false },
  { id: '7', date: '2025-08-01', category: 'balance', particulars: 'Closing Balance', credit: toPaise(0), debit: toPaise(0), balance: toPaise(224200), system: true },
  { id: '8', date: '2025-08-02', category: 'balance', particulars: 'Opening Balance', credit: toPaise(0), debit: toPaise(0), balance: toPaise(224200), system: true },
  { id: '9', date: '2025-08-02', category: 'collection', particulars: 'Chandan Collection', credit: toPaise(0), debit: toPaise(0), balance: toPaise(224200), system: false },
  { id: '10', date: '2025-08-02', category: 'balance', particulars: 'Closing Balance', credit: toPaise(0), debit: toPaise(0), balance: toPaise(224200), system: true },
];

const categories = [
  { value: 'balance', label: 'Balance' },
  { value: 'collection', label: 'Collection' },
  { value: 'advance', label: 'Advance' },
  { value: 'deposit_return', label: 'Deposit Return' },
  { value: 'deposit', label: 'Deposit' },
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
  { value: 'commission', label: 'Commission' },
  { value: 'salary', label: 'Salary' },
];

export function Cashbook() {
  const [dateFrom, setDateFrom] = useState(formatDateForInput(new Date()));
  const [dateTo, setDateTo] = useState(formatDateForInput(new Date()));
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showForm, setShowForm] = useState(false);

  const totalCredit = mockCashbook.reduce((sum, c) => sum + c.credit, 0);
  const totalDebit = mockCashbook.reduce((sum, c) => sum + c.debit, 0);
  const lastEntry = mockCashbook[mockCashbook.length - 1];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowForm(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cashbook</h1>
          <p className="text-gray-500 mt-1">Daily cash flow and running balance</p>
        </div>
        <Button onClick={() => setShowForm(true)}>+ New Entry</Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Credit</p>
                <p className="text-2xl font-bold text-green-600">{formatINR(totalCredit)}</p>
              </div>
              <div className="text-3xl">➕</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Debit</p>
                <p className="text-2xl font-bold text-red-600">{formatINR(totalDebit)}</p>
              </div>
              <div className="text-3xl">➖</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Net Movement</p>
                <p className={`text-2xl font-bold ${totalCredit - totalDebit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatINR(totalCredit - totalDebit)}
                </p>
              </div>
              <div className="text-3xl">📊</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Current Balance</p>
                <p className="text-2xl font-bold text-gray-900">{formatINR(lastEntry?.balance || 0)}</p>
              </div>
              <div className="text-3xl">💰</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* New Entry Form */}
      {showForm && (
        <Card className="animate-slide-in">
          <CardHeader>
            <CardTitle>New Cashbook Entry</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <Select required>
                    {categories.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Particulars</label>
                  <Input placeholder="Description" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Credit (+)</label>
                  <Input type="number" placeholder="0" step="1" min="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Debit (-)</label>
                  <Input type="number" placeholder="0" step="1" min="0" />
                </div>
                <div className="md:col-span-2 lg:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                  <Input placeholder="Optional remarks..." />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit">Save Entry</Button>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <Select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                <option value="">All Categories</option>
                {categories.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cashbook Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b border-gray-200 bg-gray-50">
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium">Category</th>
                  <th className="px-6 py-3 font-medium">Particulars</th>
                  <th className="px-6 py-3 font-medium text-right">Credit (+)</th>
                  <th className="px-6 py-3 font-medium text-right">Debit (-)</th>
                  <th className="px-6 py-3 font-medium text-right">Balance</th>
                  <th className="px-6 py-3 font-medium">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {mockCashbook.map((c) => (
                  <tr key={c.id} className={`hover:bg-gray-50 ${c.system ? 'bg-gray-50 font-medium' : ''}`}>
                    <td className="px-6 py-4 text-sm text-gray-900">{formatDateIN(c.date)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 capitalize">{c.category.replace('_', ' ')}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{c.particulars}</td>
                    <td className="px-6 py-4 text-sm text-right font-medium text-green-600">
                      {c.credit > 0 ? formatINR(c.credit) : '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-medium text-red-600">
                      {c.debit > 0 ? formatINR(c.debit) : '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-bold text-gray-900">
                      {formatINR(c.balance)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        c.system ? 'bg-gray-100 text-gray-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {c.system ? 'System' : 'Manual'}
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