import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { formatINR, formatPortalCustomerId, formatDateIN, toPaise } from '../shared';

export function CustomerDetail() {
  const { id } = useParams();

  // Mock customer data
  const customer = {
    id,
    portalId: '100',
    name: 'Amal Sanyal',
    mobile: '9832433875',
    address: 'BC Colony, Siliguri, West Bengal 734001',
    location: 'BC Colony',
    status: 'active',
    email: 'amal.sanyal@example.com',
    joinDate: '2022-01-15',
    cableRefId: '13FF00010FBB',
    internetRefId: null,
  };

  const accounts = [
    { type: 'Cable', plan: 'Cable Basic', monthlyRate: toPaise(20000), status: 'active', startDate: '2022-01-15' },
  ];

  const billingHistory = [
    { month: '2025-08-01', bill: toPaise(41800), paid: toPaise(45000), due: toPaise(-3600), status: 'paid' },
    { month: '2025-07-01', bill: toPaise(41800), paid: toPaise(45000), due: toPaise(-3600), status: 'paid' },
    { month: '2025-06-01', bill: toPaise(41800), paid: toPaise(38000), due: toPaise(3800), status: 'partial' },
    { month: '2025-05-01', bill: toPaise(41800), paid: toPaise(41800), due: toPaise(0), status: 'paid' },
  ];

  const recentPayments = [
    { date: '2025-08-01', amount: toPaise(45000), mode: 'Cash', collector: 'Chandan', billingMonth: '2025-08-01' },
    { date: '2025-07-01', amount: toPaise(45000), mode: 'Cash', collector: 'Chandan', billingMonth: '2025-07-01' },
    { date: '2025-06-15', amount: toPaise(38000), mode: 'Cash', collector: 'Chandan', billingMonth: '2025-06-01' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/customers" className="text-gray-500 hover:text-gray-700">← Back</Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
            <p className="text-gray-500">ID: {formatPortalCustomerId(customer.portalId)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">Record Collection</button>
        </div>
      </div>

      {/* Customer Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500">Mobile</span>
              <span className="font-medium">{customer.mobile}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Email</span>
              <span className="font-medium">{customer.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Location</span>
              <span className="font-medium">{customer.location}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Address</span>
              <span className="font-medium text-sm">{customer.address}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Status</span>
              <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                {customer.status}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Customer Since</span>
              <span className="font-medium">{formatDateIN(customer.joinDate)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Portal References</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500">Cable STB</span>
              <span className="font-mono text-sm">{customer.cableRefId || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Internet ID</span>
              <span className="font-mono text-sm">{customer.internetRefId || '—'}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500">Current Bill</span>
              <span className="font-medium">{formatINR(toPaise(41800))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Outstanding</span>
              <span className="font-medium text-red-600">{formatINR(toPaise(3600))} (Owes)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Last Payment</span>
              <span className="font-medium">{formatDateIN('2025-08-01')} - {formatINR(toPaise(45000))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Collection Rate</span>
              <span className="font-medium text-green-600">100%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Accounts */}
      <Card>
        <CardHeader>
          <CardTitle>Service Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
                  <th className="pb-3 font-medium">Type</th>
                  <th className="pb-3 font-medium">Plan</th>
                  <th className="pb-3 font-medium text-right">Monthly Rate</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Start Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {accounts.map((acc, i) => (
                  <tr key={i}>
                    <td className="py-3 text-sm text-gray-900">{acc.type}</td>
                    <td className="py-3 text-sm text-gray-900">{acc.plan}</td>
                    <td className="py-3 text-sm text-gray-900 text-right font-medium">{formatINR(acc.monthlyRate)}</td>
                    <td className="py-3 text-sm">
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        {acc.status}
                      </span>
                    </td>
                    <td className="py-3 text-sm text-gray-600">{formatDateIN(acc.startDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Billing History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Billing History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
                  <th className="pb-3 font-medium">Month</th>
                  <th className="pb-3 font-medium text-right">Bill Amount</th>
                  <th className="pb-3 font-medium text-right">Paid</th>
                  <th className="pb-3 font-medium text-right">Due</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {billingHistory.map((b, i) => (
                  <tr key={i}>
                    <td className="py-3 text-sm text-gray-900">{formatDateIN(b.month)}</td>
                    <td className="py-3 text-sm text-gray-900 text-right">{formatINR(b.bill)}</td>
                    <td className="py-3 text-sm text-gray-900 text-right">{formatINR(b.paid)}</td>
                    <td className="py-3 text-sm text-right font-medium">
                      <span className={b.due < 0 ? 'text-red-600' : b.due > 0 ? 'text-green-600' : 'text-gray-900'}>
                        {b.due < 0 ? 'Owes ' : b.due > 0 ? 'Advance ' : ''}{formatINR(Math.abs(b.due))}
                      </span>
                    </td>
                    <td className="py-3 text-sm">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        b.status === 'paid' ? 'bg-green-100 text-green-800' :
                        b.status === 'partial' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Recent Payments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Payments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium text-right">Amount</th>
                  <th className="pb-3 font-medium">Mode</th>
                  <th className="pb-3 font-medium">Collector</th>
                  <th className="pb-3 font-medium">Billed For</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentPayments.map((p, i) => (
                  <tr key={i}>
                    <td className="py-3 text-sm text-gray-900">{formatDateIN(p.date)}</td>
                    <td className="py-3 text-sm text-gray-900 text-right font-medium">{formatINR(p.amount)}</td>
                    <td className="py-3 text-sm">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        p.mode === 'Cash' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {p.mode}
                      </span>
                    </td>
                    <td className="py-3 text-sm text-gray-600">{p.collector}</td>
                    <td className="py-3 text-sm text-gray-600">{formatDateIN(p.billingMonth)}</td>
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