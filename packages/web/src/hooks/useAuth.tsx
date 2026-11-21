// useAuth.ts
import { createContext, useContext, useEffect, useState } from 'react';
import { getSupabaseClient } from '../shared';
import type { User } from '@supabase/supabase-js';
import type { Database } from '../shared/api/database.types';

type OAuthProvider = 'google' | 'github' | 'azure' | 'discord' | 'facebook' | 'gitlab';

type Organization = Database['public']['Tables']['organizations']['Row'];
type Employee = Database['public']['Tables']['employees']['Row'];

interface UserOrganization {
  organization: Organization;
  role: Employee['role'];
  permissions: Record<string, boolean>;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  organizations: UserOrganization[];
  currentOrg: UserOrganization | null;
  setCurrentOrg: (org: UserOrganization | null) => void;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithOAuth: (provider: OAuthProvider, options?: { redirectTo?: string }) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'ccn-selected-org';

function getStoredOrgId(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(STORAGE_KEY);
  }
  return null;
}

function setStoredOrgId(orgId: string | null) {
  if (typeof window !== 'undefined') {
    if (orgId) {
      localStorage.setItem(STORAGE_KEY, orgId);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState<UserOrganization[]>([]);
  const [currentOrg, setCurrentOrg] = useState<UserOrganization | null>(null);

  useEffect(() => {
    const sb = getSupabaseClient();

    // Get initial session
    sb.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = sb.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        await fetchUserOrganizations(session.user.id);
      } else {
        setOrganizations([]);
        setCurrentOrg(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserOrganizations = async (userId: string) => {
    try {
      const sb = getSupabaseClient();

      // Get user's employee records with organization details
      type EmployeeWithOrg = {
        id: string;
        role: string;
        permissions: Record<string, boolean>;
        organizations: Organization;
      };

      const { data: employees, error } = await sb
        .from('employees')
        .select(`
          id,
          role,
          permissions,
          organization_id,
          organizations!inner (
            id,
            name,
            code,
            gst_number,
            address,
            settings,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) throw error;

      const userOrgs: UserOrganization[] = (employees as EmployeeWithOrg[] || []).map(emp => ({
        organization: emp.organizations,
        role: emp.role as UserOrganization['role'],
        permissions: emp.permissions,
      }));

      setOrganizations(userOrgs);

      // Restore previously selected org or default to first
      const storedOrgId = getStoredOrgId();
      let selectedOrg = userOrgs.find(o => o.organization.id === storedOrgId);

      if (!selectedOrg && userOrgs.length > 0) {
        selectedOrg = userOrgs[0];
      }

      if (selectedOrg) {
        setCurrentOrg(selectedOrg);
        setStoredOrgId(selectedOrg.organization.id);
      } else {
        setCurrentOrg(null);
        setStoredOrgId(null);
      }
    } catch (err) {
      console.error('Failed to fetch organizations:', err);
    }
  };

  const handleSetCurrentOrg = (org: UserOrganization | null) => {
    setCurrentOrg(org);
    if (org) {
      setStoredOrgId(org.organization.id);
    } else {
      setStoredOrgId(null);
    }
  };

  const signIn = async (email: string, password: string) => {
    const sb = getSupabaseClient();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signInWithOAuth = async (provider: OAuthProvider, options?: { redirectTo?: string }) => {
    const sb = getSupabaseClient();
    const { error } = await sb.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: options?.redirectTo || `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    const sb = getSupabaseClient();
    await sb.auth.signOut();
    setUser(null);
    setOrganizations([]);
    setCurrentOrg(null);
    setStoredOrgId(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      organizations,
      currentOrg,
      setCurrentOrg: handleSetCurrentOrg,
      signIn,
      signInWithOAuth,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}