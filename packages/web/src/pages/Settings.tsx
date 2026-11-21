import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { formatINR, toPaise } from '../shared';

export function Settings() {
  const [activeTab, setActiveTab] = useState<'general' | 'employees' | 'plans' | 'categories' | 'sync'>('general');

  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'employees', label: 'Employees' },
    { id: 'plans', label: 'Service Plans' },
    { id: 'categories', label: 'Categories' },
    { id: 'sync', label: 'Sync & Backup' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Configure your business management system</p>
      </div>

      {/* Tab Navigation */}
      <Card>
        <CardContent className="p-1">
          <div className="flex overflow-x-auto" role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-shrink-0 py-2 px-4 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  activeTab === tab.id
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

      {/* Tab Content */}
      {activeTab === 'general' && <GeneralSettings />}
      {activeTab === 'employees' && <EmployeeSettings />}
      {activeTab === 'plans' && <PlanSettings />}
      {activeTab === 'categories' && <CategorySettings />}
      {activeTab === 'sync' && <SyncSettings />}
    </div>
  );
}

function GeneralSettings() {
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>General Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 max-w-2xl">
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Organization Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name</label>
              <Input defaultValue="Film Cable Centre (CCN36)" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Organization Code</label>
              <Input defaultValue="CCN36" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">GST Number</label>
              <Input placeholder="19AAACF1234A1Z5" />
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Address</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
              <Input defaultValue="BC Colony" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
              <Input placeholder="Optional" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <Input defaultValue="Siliguri" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <Input defaultValue="West Bengal" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PIN Code</label>
              <Input defaultValue="734001" />
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Preferences</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
              <Select defaultValue="Asia/Kolkata">
                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                <option value="UTC">UTC</option>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date Format</label>
              <Select defaultValue="DD-MM-YYYY">
                <option value="DD-MM-YYYY">DD-MM-YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <Select defaultValue="INR">
                <option value="INR">INR (₹)</option>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Financial Year Start</label>
              <Select defaultValue="4">
                <option value="1">January</option>
                <option value="4">April (India)</option>
                <option value="7">July</option>
                <option value="10">October</option>
              </Select>
            </div>
            <div className="md:col-span-2 flex items-center">
              <label className="flex items-center">
                <input type="checkbox" className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" defaultChecked />
                <span className="ml-2 text-sm text-gray-700">Auto carry-forward previous balance</span>
              </label>
            </div>
            <div className="md:col-span-2 flex items-center">
              <label className="flex items-center">
                <input type="checkbox" className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" defaultChecked />
                <span className="ml-2 text-sm text-gray-700">Enable offline mode</span>
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-gray-200 pt-6">
          <Button>Save Changes</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EmployeeSettings() {
  const employees = [
    { id: '1', name: 'Tarun', email: 'tarun@ccn.local', role: 'owner', phone: '9832068252', status: 'active' },
    { id: '2', name: 'Admin User', email: 'admin@ccn.local', role: 'admin', phone: '9832068253', status: 'active' },
    { id: '3', name: 'Chandan', email: 'chandan@ccn.local', role: 'collector', phone: '9382829550', status: 'active' },
    { id: '4', name: 'Rajib', email: 'rajib@ccn.local', role: 'collector', phone: '9832068254', status: 'active' },
    { id: '5', name: 'Choton', email: 'choton@ccn.local', role: 'collector', phone: '9832068255', status: 'active' },
  ];

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Employee Management</CardTitle>
        <Button>+ Add Employee</Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Email</th>
                <th className="px-6 py-3 font-medium">Role</th>
                <th className="px-6 py-3 font-medium">Phone</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                        <span className="text-sm font-medium text-indigo-700">{emp.name.charAt(0)}</span>
                      </div>
                      <span className="ml-3 font-medium text-gray-900">{emp.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{emp.email}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      emp.role === 'owner' ? 'bg-purple-100 text-purple-800' :
                      emp.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                      emp.role === 'collector' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {emp.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{emp.phone}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      emp.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {emp.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex space-x-2">
                      <Button variant="ghost" size="sm">Edit</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function PlanSettings() {
  const plans = [
    { id: '1', name: 'Cable Basic', type: 'cable', rate: 20000, active: true },
    { id: '2', name: 'Cable HD', type: 'cable', rate: 35000, active: true },
    { id: '3', name: 'Internet 30Mbps', type: 'internet', rate: 40000, active: true },
    { id: '4', name: 'Internet 50Mbps', type: 'internet', rate: 60000, active: true },
    { id: '5', name: 'Combo Basic', type: 'combo', rate: 50000, active: true },
    { id: '6', name: 'Combo Premium', type: 'combo', rate: 80000, active: true },
  ];

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Service Plans</CardTitle>
        <Button>+ Add Plan</Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
                <th className="px-6 py-3 font-medium">Plan Name</th>
                <th className="px-6 py-3 font-medium">Type</th>
                <th className="px-6 py-3 font-medium text-right">Monthly Rate</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {plans.map((plan) => (
                <tr key={plan.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{plan.name}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      plan.type === 'cable' ? 'bg-blue-100 text-blue-800' :
                      plan.type === 'internet' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'
                    }`}>
                      {plan.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right font-medium text-gray-900">{formatINR(toPaise(plan.rate))}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      plan.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {plan.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Button variant="ghost" size="sm">Edit</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function CategorySettings() {
  const categories = [
    { name: 'Balance', type: 'System', color: 'bg-gray-100' },
    { name: 'Collection', type: 'Income', color: 'bg-green-100' },
    { name: 'Advance', type: 'Transfer', color: 'bg-yellow-100' },
    { name: 'Deposit Return', type: 'Transfer', color: 'bg-blue-100' },
    { name: 'Deposit', type: 'Transfer', color: 'bg-indigo-100' },
    { name: 'Income', type: 'Income', color: 'bg-emerald-100' },
    { name: 'Expense', type: 'Expense', color: 'bg-red-100' },
    { name: 'Commission', type: 'Expense', color: 'bg-orange-100' },
    { name: 'Salary', type: 'Expense', color: 'bg-pink-100' },
  ];

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Cashbook Categories</CardTitle>
        <Button>+ Add Category</Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
                <th className="px-6 py-3 font-medium">Category</th>
                <th className="px-6 py-3 font-medium">Type</th>
                <th className="px-6 py-3 font-medium">Color</th>
                <th className="px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {categories.map((cat) => (
                <tr key={cat.name} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{cat.name}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${cat.color} text-gray-800`}>
                      {cat.type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="w-6 h-6 rounded border border-gray-300" style={{ backgroundColor: cat.color.replace('bg-', '').replace('-100', '-200') }}></div>
                  </td>
                  <td className="px-6 py-4">
                    <Button variant="ghost" size="sm">Edit</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function SyncSettings() {
  return (
    <div className="mt-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Data Synchronization</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Sync Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4">
                <p className="text-sm text-gray-500">Last Full Sync</p>
                <p className="text-xl font-bold text-gray-900 mt-1">2 hours ago</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-gray-500">Pending Changes</p>
                <p className="text-xl font-bold text-gray-900 mt-1">0</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-gray-500">Conflicts</p>
                <p className="text-xl font-bold text-gray-900 mt-1">0</p>
              </Card>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Sync Actions</h3>
            <div className="flex flex-wrap gap-4">
              <Button>Sync Now</Button>
              <Button variant="outline">Pull from Server</Button>
              <Button variant="outline">Push to Server</Button>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Auto Sync Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center">
                <input type="checkbox" id="auto-sync" className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" defaultChecked />
                <label htmlFor="auto-sync" className="ml-2 text-sm text-gray-700">Enable automatic sync</label>
              </div>
              <div className="flex items-center">
                <input type="checkbox" id="sync-on-wifi" className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" defaultChecked />
                <label htmlFor="sync-on-wifi" className="ml-2 text-sm text-gray-700">Sync only on WiFi (mobile)</label>
              </div>
              <div className="flex items-center">
                <input type="checkbox" id="sync-on-startup" className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" defaultChecked />
                <label htmlFor="sync-on-startup" className="ml-2 text-sm text-gray-700">Sync on app startup</label>
              </div>
              <div className="flex items-center">
                <label className="text-sm text-gray-700 mr-2">Sync interval:</label>
                <Select defaultValue="15">
                  <option value="5">Every 5 minutes</option>
                  <option value="15">Every 15 minutes</option>
                  <option value="30">Every 30 minutes</option>
                  <option value="60">Every hour</option>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Backup & Restore</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <Button variant="outline">Export All Data (JSON)</Button>
            <Button variant="outline">Export Data (Excel)</Button>
            <Button variant="outline">Import Data</Button>
          </div>
          <p className="text-sm text-gray-500">
            Backups include: Customers, Accounts, Billing Records, Payments, Cashbook Entries, and Settings.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Offline Storage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <Card className="p-4">
              <p className="text-2xl font-bold text-gray-900">~45 MB</p>
              <p className="text-sm text-gray-500">IndexedDB Usage</p>
            </Card>
            <Card className="p-4">
              <p className="text-2xl font-bold text-gray-900">1,247</p>
              <p className="text-sm text-gray-500">Cached Customers</p>
            </Card>
            <Card className="p-4">
              <p className="text-2xl font-bold text-gray-900">3,456</p>
              <p className="text-sm text-gray-500">Cached Transactions</p>
            </Card>
          </div>
          <div className="flex gap-4">
            <Button variant="outline">Clear Offline Cache</Button>
            <Button variant="outline" className="ml-auto">Rebuild Cache</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}