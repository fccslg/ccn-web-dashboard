import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: '📊' },
  { name: 'Customers', href: '/customers', icon: '👥' },
  { name: 'Collections', href: '/collections', icon: '💰' },
  { name: 'Cashbook', href: '/cashbook', icon: '📒' },
  { name: 'Reports', href: '/reports', icon: '📈' },
  { name: 'Settings', href: '/settings', icon: '⚙️' },
];

export function Layout() {
  const location = useLocation();
  const { user, signOut, organizations, currentOrg, setCurrentOrg } = useAuth();
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar - Always expanded */}
      <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg border-r border-gray-200">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center h-16 border-b border-gray-200 px-4">
            <span className="text-xl font-bold text-indigo-600">CCN</span>
            <span className="ml-2 text-sm text-gray-500">Business</span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const hrefActive = location.pathname === item.href ||
                (item.href !== '/dashboard' && location.pathname.startsWith(item.href));
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={({ isActive: navActive }) =>
                    `flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                      navActive || hrefActive
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`
                  }
                >
                  <span className="mr-3 flex-shrink-0">{item.icon}</span>
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* User info & Sign out */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center mb-3">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-medium text-indigo-700">
                  {user?.email?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <div className="ml-3 flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.email || 'User'}
                </p>
                <p className="text-xs text-gray-500 truncate">Administrator</p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="w-full flex items-center px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <span className="mr-3 flex-shrink-0">🚪</span>
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="min-h-screen ml-64">
        <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
          <div className="px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Top Navbar - Horizontal Navigation */}
              <nav className="flex items-center gap-1 px-2 py-1 bg-gray-50 rounded-lg border border-gray-100" aria-label="Main navigation">
                {navigation.map((item) => {
                  const isActive = location.pathname === item.href ||
                    (item.href !== '/dashboard' && location.pathname.startsWith(item.href));
                  return (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      className={({ isActive: navActive }) =>
                        `flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                          navActive || isActive
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                        }`
                      }
                    >
                      <span className="flex-shrink-0">{item.icon}</span>
                      <span>{item.name}</span>
                    </NavLink>
                  );
                })}
              </nav>
            </div>
            <div className="flex items-center gap-4">
              {/* Organization Selector */}
              {organizations.length > 0 && (
                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setOrgDropdownOpen(!orgDropdownOpen)}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    aria-label="Switch organization"
                  >
                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    <span className="truncate max-w-[200px]">
                      {currentOrg?.organization.name || 'Select Organization'}
                    </span>
                    <svg className={`w-4 h-4 text-gray-500 transition-transform ${orgDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {orgDropdownOpen && (
                    <div className="absolute right-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
                      {organizations.map((org) => (
                        <button
                          key={org.organization.id}
                          onClick={() => { setCurrentOrg(org); setOrgDropdownOpen(false); }}
                          className={`w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 ${
                            currentOrg?.organization.id === org.organization.id ? 'bg-indigo-50 text-indigo-700 font-medium' : ''
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${currentOrg?.organization.id === org.organization.id ? 'bg-indigo-500' : 'bg-gray-300'}`} />
                          <span className="truncate">{org.organization.name}</span>
                          <span className="text-xs text-gray-500 capitalize">{org.role}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}