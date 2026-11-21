import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { formatINR, toPaise } from '../shared';

export function Dashboard() {
  // Mock data for now
  const stats = [
    { label: 'Total Customers', value: '1,247', icon: '👥', trend: '+12%' },
    { label: 'Active Customers', value: '1,189', icon: '✅', trend: '+5%' },
    { label: 'Monthly Billed', value: formatINR(toPaise(4500000)), icon: '📋', trend: '+8%' },
    { label: 'Monthly Collected', value: formatINR(toPaise(3800000)), icon: '💰', trend: '+10%' },
    { label: 'Outstanding Dues', value: formatINR(toPaise(2200000)), icon: '⏰', trend: '-3%' },
    { label: "Today's Collections", value: formatINR(toPaise(125000)), icon: '📅', trend: '+15%' },
    { label: 'Cash in Hand', value: formatINR(toPaise(450000)), icon: '💵', trend: '+2%' },
    { label: 'Monthly Expenses', value: formatINR(toPaise(180000)), icon: '💸', trend: '-5%' },
  ];

  const recentCollections = [
    { customer: 'Bikash Mallik', amount: toPaise(45000), mode: 'Cash', collector: 'Chandan', time: '10:30 AM' },
    { customer: 'Sampa Das', amount: toPaise(54000), mode: 'GPay', collector: 'Tarun', time: '11:15 AM' },
    { customer: 'Raju Sarkar', amount: toPaise(105000), mode: 'GPay', collector: 'Tarun', time: '11:45 AM' },
    { customer: 'Akash Poddar', amount: toPaise(38000), mode: 'Cash', collector: 'Chandan', time: '12:10 PM' },
    { customer: 'Babu Ghosh II', amount: toPaise(60000), mode: 'GPay', collector: 'Tarun', time: '01:20 PM' },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                  <p className="text-xs text-green-600 mt-1">{stat.trend} vs last month</p>
                </div>
                <div className="text-3xl">{stat.icon}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Collections */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Collections</CardTitle>
          <a href="/collections" className="text-sm text-indigo-600 hover:underline">
            View All →
          </a>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
                  <th className="pb-3 font-medium">Customer</th>
                  <th className="pb-3 font-medium text-right">Amount</th>
                  <th className="pb-3 font-medium">Mode</th>
                  <th className="pb-3 font-medium">Collector</th>
                  <th className="pb-3 font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentCollections.map((c, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="py-3 text-sm text-gray-900">{c.customer}</td>
                    <td className="py-3 text-sm text-gray-900 text-right font-medium">
                      {formatINR(c.amount)}
                    </td>
                    <td className="py-3 text-sm">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        c.mode === 'Cash' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {c.mode}
                      </span>
                    </td>
                    <td className="py-3 text-sm text-gray-600">{c.collector}</td>
                    <td className="py-3 text-sm text-gray-500">{c.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6 text-center hover:shadow-md transition-shadow cursor-pointer">
          <div className="text-4xl mb-2">➕</div>
          <h3 className="font-semibold text-gray-900">New Collection</h3>
          <p className="text-sm text-gray-500 mt-1">Record a customer payment</p>
        </Card>
        <Card className="p-6 text-center hover:shadow-md transition-shadow cursor-pointer">
          <div className="text-4xl mb-2">👤</div>
          <h3 className="font-semibold text-gray-900">Add Customer</h3>
          <p className="text-sm text-gray-500 mt-1">Register new customer</p>
        </Card>
        <Card className="p-6 text-center hover:shadow-md transition-shadow cursor-pointer">
          <div className="text-4xl mb-2">📒</div>
          <h3 className="font-semibold text-gray-900">Cashbook Entry</h3>
          <p className="text-sm text-gray-500 mt-1">Record income/expense</p>
        </Card>
      </div>
    </div>
  );
}