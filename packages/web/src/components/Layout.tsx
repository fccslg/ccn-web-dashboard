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
  const { user, signOut } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-white shadow-lg border-r border-gray-200 transition-all duration-300 ease-in-out ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center h-16 border-b border-gray-200 px-4 transition-all duration-300">
            <span className={`text-xl font-bold text-indigo-600 ${sidebarCollapsed ? 'text-center' : ''}`}>CCN</span>
            {!sidebarCollapsed && (
              <span className="ml-2 text-sm text-gray-500 transition-opacity duration-200 opacity-100">Business</span>
            )}
            {sidebarCollapsed && <span className="ml-2 text-sm text-gray-500 opacity-0">Business</span>}
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
                  title={sidebarCollapsed ? item.name : undefined}
                >
                  <span className="mr-3 flex-shrink-0">{item.icon}</span>
                  {!sidebarCollapsed && (
                    <span className="transition-opacity duration-200 opacity-100">{item.name}</span>
                  )}
                  {sidebarCollapsed && <span className="opacity-0"> {item.name}</span>}
                </NavLink>
              );
            })}
          </nav>

          {/* User info & Sign out */}
          <div className={`p-4 border-t border-gray-200 transition-all duration-300 ${
            sidebarCollapsed ? 'px-2' : ''
          }`}>
            <div className="flex items-center mb-3">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-medium text-indigo-700">
                  {user?.email?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              {!sidebarCollapsed && (
                <div className="ml-3 flex-1 min-w-0 transition-opacity duration-200 opacity-100">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user?.email || 'User'}
                  </p>
                  <p className="text-xs text-gray-500 truncate">Administrator</p>
                </div>
              )}
              {sidebarCollapsed && (
                <div className="ml-2 opacity-0 w-0 overflow-hidden">Hidden</div>
              )}
            </div>
            <button
              onClick={signOut}
              className={`w-full flex items-center px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 transition-colors ${
                sidebarCollapsed ? 'justify-center' : ''
              }`}
              title={sidebarCollapsed ? 'Sign Out' : undefined}
            >
              <span className="mr-3 flex-shrink-0">🚪</span>
              {!sidebarCollapsed && <span className="transition-opacity duration-200 opacity-100">Sign Out</span>}
              {sidebarCollapsed && <span className="opacity-0">Sign Out</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className={`min-h-screen transition-all duration-300 ease-in-out ${
        sidebarCollapsed ? 'ml-20' : 'ml-64'
      }`}>
        <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
          <div className="px-6 py-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">
              {navigation.find(n => location.pathname === n.href || location.pathname.startsWith(n.href))?.name || 'Dashboard'}
            </h1>
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {sidebarCollapsed ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 19l7-7-7-7m-8 14l7-7-7-7" />
                )}
              </svg>
            </button>
          </div>
        </header>

        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}