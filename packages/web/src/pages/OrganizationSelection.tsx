import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

export function OrganizationSelection() {
  const { organizations, currentOrg, setCurrentOrg, user, loading: authLoading, refreshOrganizations } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgCode, setNewOrgCode] = useState('');
  const navigate = useNavigate();
  // userNavigatedHere defaults to true so auto-redirect doesn't run on intentional navigation
  const [userNavigatedHere] = useState(true);

  // Define handlers at the top to avoid terser minification issues
  const handleSignOut = useCallback(async () => {
    const { getSupabaseClient } = await import('../shared');
    const sb = getSupabaseClient();
    await sb.auth.signOut();
    navigate('/login');
  }, [navigate]);

  const handleSelectOrg = useCallback((org: typeof organizations[0]) => {
    setCurrentOrg(org);
    navigate('/dashboard');
  }, [setCurrentOrg, navigate]);

  const handleCreateOrg = useCallback(async () => {
    if (!newOrgName || !newOrgCode) return;
    if (!user) return;

    setLoading(true);
    setError('');

    try {
      const sb = (await import('../shared')).getSupabaseClient();

      // Check if organization code already exists
      const { data: existingOrg, error: checkError } = await sb
        .from('organizations')
        .select('id')
        .eq('code', newOrgCode.toUpperCase())
        .maybeSingle();

      if (checkError) {
        throw checkError;
      }

      if (existingOrg) {
        throw new Error('Organization code already exists. Please choose a different code.');
      }

      // Create organization
      type OrgInsert = { id: string };
      const { data: orgData, error: orgError } = await sb
        .from('organizations')
        .insert({
          name: newOrgName,
          code: newOrgCode.toUpperCase(),
          settings: {
            timezone: 'Asia/Kolkata',
            date_format: 'DD-MM-YYYY',
            currency: 'INR',
            financial_year_start_month: 4,
            auto_carry_forward_pbal: true,
            default_payment_mode: 'cash',
          },
        } as any)
        .select('id')
        .single();

      if (orgError) {
        console.error('Org insert error:', orgError);
        throw new Error(`Organization creation failed: ${orgError.message}`);
      }

      const orgId = (orgData as OrgInsert).id;
      console.log('Organization created:', orgId);

      // Create employee record linking user to new org as owner
      const { error: empError } = await sb
        .from('employees')
        .insert({
          user_id: user.id,
          organization_id: orgId,
          name: user.email?.split('@')[0] || newOrgName || 'Owner',
          role: 'owner',
          permissions: {
            can_manage_employees: true,
            can_manage_customers: true,
            can_view_all_financials: true,
            can_approve_corrections: true,
            can_import_export: true,
            can_configure_system: true,
            assigned_locations: [],
            assigned_collectors: [],
          },
          is_active: true,
        } as any);

      if (empError) {
        console.error('Employee insert error:', empError);
        // Try to clean up the org we just created
        await sb.from('organizations').delete().eq('id', orgId);
        throw new Error(`Employee record creation failed: ${empError.message}`);
      }
      console.log('Employee record created');

      // Clear stored org so user must select from the list
      localStorage.removeItem('ccn-selected-org');

      // Refresh organizations list
      await refreshOrganizations();

      // Stay on select-organization page to let user pick the new org
      setShowCreateOrg(false);
    } catch (err: any) {
      // Better error logging
      console.error('Create org error:', err);
      if (err?.message) {
        console.error('Error message:', err.message);
      }
      if (err?.code) {
        console.error('Error code:', err.code);
      }
      setError(err instanceof Error ? err.message : 'Failed to create organization');
    } finally {
      setLoading(false);
    }
  }, [newOrgName, newOrgCode, user, navigate]);

  // Effect for auto-redirect when org is selected
  // Only auto-redirect if we're not intentionally showing the create org form
  // AND the user didn't explicitly navigate here
  useEffect(() => {
    if (currentOrg && !authLoading && !showCreateOrg && organizations.length > 0 && !userNavigatedHere) {
      navigate('/dashboard');
    }
  }, [currentOrg, authLoading, navigate, showCreateOrg, organizations.length, userNavigatedHere]);

  // If no organizations yet (new user), show create org form
  if (organizations.length === 0 && !authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full space-y-8">
          <div>
            <div className="mx-auto h-12 w-12 bg-indigo-600 rounded-xl flex items-center justify-center">
              <span className="text-white text-xl font-bold">CCN</span>
            </div>
            <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">Welcome!</h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Set up your first organization to get started
            </p>
          </div>
          <div className="text-center text-sm text-gray-600 mb-4">
            <p>Signed in as {user?.email}</p>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="mt-2">
              Sign Out
            </Button>
          </div>

          <Card>
            <CardContent className="p-6">
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}
              <form onSubmit={(e) => { e.preventDefault(); handleCreateOrg(); }} className="space-y-4">
                <div>
                  <label htmlFor="org-name" className="block text-sm font-medium text-gray-700 mb-1">
                    Organization Name
                  </label>
                  <Input
                    id="org-name"
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    placeholder="e.g., Film Cable Centre"
                    required
                    disabled={loading}
                  />
                </div>
                <div>
                  <label htmlFor="org-code" className="block text-sm font-medium text-gray-700 mb-1">
                    Organization Code
                  </label>
                  <Input
                    id="org-code"
                    value={newOrgCode}
                    onChange={(e) => setNewOrgCode(e.target.value.toUpperCase())}
                    placeholder="e.g., CCN36"
                    required
                    maxLength={10}
                    disabled={loading}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading || !newOrgName || !newOrgCode}
                  className="w-full"
                >
                  {loading ? 'Creating...' : 'Create Organization'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // If single organization, auto-select and redirect
  if (organizations.length === 1 && !currentOrg && !authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 text-sm text-gray-500">
          <p>Signed in as {user?.email}</p>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="mt-1">
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  // Multiple organizations - show selection
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-12 w-12 bg-indigo-600 rounded-xl flex items-center justify-center">
            <span className="text-white text-xl font-bold">CCN</span>
          </div>
          <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">Select Organization</h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Signed in as {user?.email}
          </p>
          <Button variant="ghost" size="sm" className="mt-4" onClick={handleSignOut}>
            Sign Out
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-center">Choose an Organization</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {organizations.map((org) => (
              <Button
                key={org.organization.id}
                variant={currentOrg?.organization.id === org.organization.id ? 'primary' : 'outline'}
                className="w-full justify-start"
                onClick={() => handleSelectOrg(org)}
                disabled={loading}
              >
                <div className="flex items-center gap-3 w-full">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <span className="text-sm font-medium text-indigo-700">
                      {org.organization.code || org.organization.name.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-medium text-gray-900 truncate">{org.organization.name}</p>
                    <p className="text-xs text-gray-500 capitalize">{org.role}</p>
                  </div>
                  {currentOrg?.organization.id === org.organization.id && (
                    <svg className="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </Button>
            ))}

            <hr className="my-4 border-gray-200" />

            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setShowCreateOrg(true)}
            >
              + Create New Organization
            </Button>
          </CardContent>
        </Card>

        {/* Create Organization Modal */}
        {showCreateOrg && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Create New Organization</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={(e) => { e.preventDefault(); handleCreateOrg(); }}>
                  <div>
                    <label htmlFor="new-org-name" className="block text-sm font-medium text-gray-700 mb-1">
                      Organization Name
                    </label>
                    <Input
                      id="new-org-name"
                      value={newOrgName}
                      onChange={(e) => setNewOrgName(e.target.value)}
                      placeholder="e.g., Film Cable Centre"
                      required
                      autoFocus
                    />
                  </div>
                  <div>
                    <label htmlFor="new-org-code" className="block text-sm font-medium text-gray-700 mb-1">
                      Organization Code
                    </label>
                    <Input
                      id="new-org-code"
                      value={newOrgCode}
                      onChange={(e) => setNewOrgCode(e.target.value.toUpperCase())}
                      placeholder="e.g., CCN36"
                      required
                      maxLength={10}
                    />
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button variant="outline" onClick={() => setShowCreateOrg(false)} className="flex-1">
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={loading || !newOrgName || !newOrgCode}
                    >
                      {loading ? 'Creating...' : 'Create'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}