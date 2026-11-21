import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const { user, signOut, organizations, currentOrg, setCurrentOrg } = useAuth();
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar - Collapsible */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-white shadow-lg border-r border-gray-200 transition-all duration-300 ease-in-out ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo / Org Info */}
          <div className={`flex items-center justify-between h-16 border-b border-gray-200 px-4 transition-all duration-300 ${sidebarCollapsed ? 'justify-center' : ''}`}>
            {!sidebarCollapsed && currentOrg && (
              <div className="flex-1 min-w-0 flex flex-col items-start justify-center">
                <span className="text-xl font-bold text-indigo-600 uppercase truncate">
                  {currentOrg.organization.code}
                </span>
                <span className="text-xs text-gray-500 truncate">
                  {currentOrg.organization.name}
                </span>
              </div>
            )}
            {!sidebarCollapsed && !currentOrg && (
              <div className="flex-1 flex flex-col items-start justify-center">
                <span className="text-xl font-bold text-indigo-600">CCN</span>
                <span className="text-xs text-gray-500">Select Organization</span>
              </div>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={`p-2 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0 ${
                sidebarCollapsed ? 'ml-auto' : 'ml-4'
              }`}
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

          {/* Navigation */}
          <nav className={`flex-1 px-4 py-4 space-y-1 ${sidebarCollapsed ? 'overflow-hidden' : 'overflow-y-auto'}`}>
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
          <div className={`p-4 border-t border-gray-200 transition-all duration-300 ${sidebarCollapsed ? 'px-2' : ''}`}>
            <div className={`flex items-center mb-3 ${sidebarCollapsed ? 'justify-center' : ''}`}>
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
            </div>
            <button
              onClick={signOut}
              className={`w-full flex items-center px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 transition-colors ${
                sidebarCollapsed ? 'justify-center' : ''
              }`}
              title={sidebarCollapsed ? 'Sign Out' : undefined}
            >
              <span className={`flex-shrink-0 ${sidebarCollapsed ? '' : 'mr-3'}`}>🚪</span>
              {!sidebarCollapsed && <span className="transition-opacity duration-200 opacity-100">Sign Out</span>}
              {sidebarCollapsed && <span className="sr-only">Sign Out</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className={`min-h-screen transition-all duration-300 ease-in-out ${sidebarCollapsed ? 'ml-20' : 'ml-64'}`}>
        <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
          <div className="px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-900">
                {navigation.find(n => location.pathname === n.href || location.pathname.startsWith(n.href))?.name || 'Dashboard'}
              </h1>
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
                      <hr className="my-1 border-gray-200" />
                      <button
                        onClick={() => { setOrgDropdownOpen(false); navigate('/select-organization'); }}
                        className="w-full px-4 py-2 text-left text-sm text-indigo-600 hover:bg-indigo-50 flex items-center gap-2"
                      >
                        <span className="w-5 h-5 flex items-center justify-center">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        </span>
                        <span>Create New Organization</span>
                      </button>
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