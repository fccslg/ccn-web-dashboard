import { useState } from 'react';
import { Card, CardContent } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { formatINR, formatDateIN, formatDateForInput, toPaise } from '../shared';

const mockReportData = {
  daily: [
    { date: '2025-08-01', collections: toPaise(450000), expenses: toPaise(8000), net: toPaise(442000) },
    { date: '2025-08-02', collections: toPaise(380000), expenses: toPaise(5000), net: toPaise(375000) },
    { date: '2025-08-03', collections: toPaise(420000), expenses: toPaise(12000), net: toPaise(408000) },
    { date: '2025-08-04', collections: toPaise(390000), expenses: toPaise(8000), net: toPaise(382000) },
    { date: '2025-08-05', collections: toPaise(410000), expenses: toPaise(6000), net: toPaise(404000) },
  ],
  collector: [
    { collector: 'Chandan', cash: toPaise(1250000), digital: toPaise(450000), total: toPaise(1700000), count: 85 },
    { collector: 'Rajib', cash: toPaise(850000), digital: toPaise(320000), total: toPaise(1170000), count: 62 },
    { collector: 'Tarun', cash: toPaise(200000), digital: toPaise(850000), total: toPaise(1050000), count: 45 },
    { collector: 'Choton', cash: toPaise(150000), digital: toPaise(100000), total: toPaise(250000), count: 12 },
  ],
  outstanding: [
    { customer: 'Bikash Mallik', portalId: '100', location: 'BC Colony', mobile: '9832202715', due: toPaise(3600), lastPayment: '2025-07-31' },
    { customer: 'Akash Poddar', portalId: '262', location: 'S.R. Colony', mobile: '9800090004', due: toPaise(3000), lastPayment: '2025-07-15' },
    { customer: 'Shyamal Saha', portalId: '255', location: 'Dashratpally', mobile: '9749145119', due: toPaise(2700), lastPayment: '2025-07-20' },
    { customer: 'Bela Mondol', portalId: '116', location: 'Janata Nagar', mobile: '9832470776', due: toPaise(1500), lastPayment: '2025-07-25' },
  ],
};

export function Reports() {
  const [reportType, setReportType] = useState<'daily' | 'collector' | 'outstanding'>('daily');
  const [dateFrom, setDateFrom] = useState(formatDateForInput(new Date()));
  const [dateTo, setDateTo] = useState(formatDateForInput(new Date()));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-500 mt-1">Business performance and financial reports</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Export Excel</Button>
          <Button variant="outline">Export PDF</Button>
        </div>
      </div>

      {/* Report Type Tabs */}
      <Card>
        <CardContent className="p-1">
          <div className="flex" role="tablist">
            {[
              { id: 'daily', label: 'Daily Summary' },
              { id: 'collector', label: 'Collector Performance' },
              { id: 'outstanding', label: 'Outstanding Dues' },
            ].map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={reportType === tab.id}
                onClick={() => setReportType(tab.id as any)}
                className={`flex-1 py-2 px-4 text-sm font-medium rounded-lg transition-colors ${
                  reportType === tab.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Date Range Filter (for daily reports) */}
      {reportType === 'daily' && (
        <Card className="mt-4">
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
              <div className="md:col-span-2 flex items-end">
                <Button variant="outline">Generate Report</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Report Content */}
      <Card>
        <CardContent className="p-0">
          {reportType === 'daily' && (
            <DailyReport data={mockReportData.daily} />
          )}
          {reportType === 'collector' && (
            <CollectorReport data={mockReportData.collector} />
          )}
          {reportType === 'outstanding' && (
            <OutstandingReport data={mockReportData.outstanding} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DailyReport({ data }: { data: typeof mockReportData.daily }) {
  const totals = data.reduce((acc, d) => ({
    collections: acc.collections + d.collections,
    expenses: acc.expenses + d.expenses,
    net: acc.net + d.net,
  }), { collections: 0, expenses: 0, net: 0 });

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="text-left text-sm text-gray-500 border-b border-gray-200 bg-gray-50">
            <th className="px-6 py-3 font-medium">Date</th>
            <th className="px-6 py-3 font-medium text-right">Collections</th>
            <th className="px-6 py-3 font-medium text-right">Expenses</th>
            <th className="px-6 py-3 font-medium text-right">Net Cash Flow</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map((d, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="px-6 py-4 text-sm text-gray-900">{formatDateIN(d.date)}</td>
              <td className="px-6 py-4 text-sm text-right text-green-600 font-medium">{formatINR(d.collections)}</td>
              <td className="px-6 py-4 text-sm text-right text-red-600 font-medium">{formatINR(d.expenses)}</td>
              <td className="px-6 py-4 text-sm text-right font-bold">{d.net >= 0 ? '+' : ''}{formatINR(d.net)}</td>
            </tr>
          ))}
          <tr className="bg-gray-50 font-bold">
            <td className="px-6 py-4 text-sm text-gray-900">TOTAL</td>
            <td className="px-6 py-4 text-sm text-right text-green-600">{formatINR(totals.collections)}</td>
            <td className="px-6 py-4 text-sm text-right text-red-600">{formatINR(totals.expenses)}</td>
            <td className="px-6 py-4 text-sm text-right">{totals.net >= 0 ? '+' : ''}{formatINR(totals.net)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function CollectorReport({ data }: { data: typeof mockReportData.collector }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="text-left text-sm text-gray-500 border-b border-gray-200 bg-gray-50">
            <th className="px-6 py-3 font-medium">Collector</th>
            <th className="px-6 py-3 font-medium text-right">Cash</th>
            <th className="px-6 py-3 font-medium text-right">Digital</th>
            <th className="px-6 py-3 font-medium text-right">Total</th>
            <th className="px-6 py-3 font-medium text-right">Transactions</th>
            <th className="px-6 py-3 font-medium text-right">Avg/Transaction</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map((d, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="px-6 py-4 text-sm font-medium text-gray-900">{d.collector}</td>
              <td className="px-6 py-4 text-sm text-right text-green-600">{formatINR(d.cash)}</td>
              <td className="px-6 py-4 text-sm text-right text-blue-600">{formatINR(d.digital)}</td>
              <td className="px-6 py-4 text-sm text-right font-bold text-gray-900">{formatINR(d.total)}</td>
              <td className="px-6 py-4 text-sm text-right text-gray-600">{d.count}</td>
              <td className="px-6 py-4 text-sm text-right text-gray-600">{formatINR(Math.round(d.total / d.count))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OutstandingReport({ data }: { data: typeof mockReportData.outstanding }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="text-left text-sm text-gray-500 border-b border-gray-200 bg-gray-50">
            <th className="px-6 py-3 font-medium">Customer</th>
            <th className="px-6 py-3 font-medium">ID</th>
            <th className="px-6 py-3 font-medium">Location</th>
            <th className="px-6 py-3 font-medium">Mobile</th>
            <th className="px-6 py-3 font-medium text-right">Outstanding</th>
            <th className="px-6 py-3 font-medium">Last Payment</th>
            <th className="px-6 py-3 font-medium">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map((d, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="px-6 py-4">
                <div className="font-medium text-gray-900">{d.customer}</div>
              </td>
              <td className="px-6 py-4 text-sm text-gray-600 font-mono">{d.portalId}</td>
              <td className="px-6 py-4 text-sm text-gray-600">{d.location}</td>
              <td className="px-6 py-4 text-sm text-gray-600">{d.mobile}</td>
              <td className="px-6 py-4 text-sm text-right font-bold text-red-600">{formatINR(d.due)}</td>
              <td className="px-6 py-4 text-sm text-gray-600">{formatDateIN(d.lastPayment)}</td>
              <td className="px-6 py-4">
                <button className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">Collect</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}