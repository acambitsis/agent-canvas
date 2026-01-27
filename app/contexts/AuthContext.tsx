/**
 * AuthContext - Manages user authentication and organization state
 *
 * Uses WorkOS AuthKit SDK for session management and org memberships from Convex.
 */

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth as useAuthKit } from '@workos-inc/authkit-nextjs/components';
import { User, Organization } from '@/types/auth';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { ORG_ROLES } from '@/types/validationConstants';

interface AuthContextValue {
  user: User | null;
  userOrgs: Organization[];
  currentOrgId: string | null;
  isInitialized: boolean;
  isAuthenticated: boolean;
  setCurrentOrgId: (orgId: string) => void;
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  syncMemberships: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Use WorkOS AuthKit SDK for user session
  const authKit = useAuthKit();
  const authKitUser = authKit.user;
  const isLoading = authKit.loading;

  // Local state for org data
  const [userOrgs, setUserOrgs] = useState<Organization[]>([]);
  const [currentOrgId, setCurrentOrgIdState] = useLocalStorage<string | null>(STORAGE_KEYS.CURRENT_ORG, null);
  const [isInitialized, setIsInitialized] = useState(false);
  const currentOrgIdRef = useRef(currentOrgId);

  // Keep ref in sync with state
  useEffect(() => {
    currentOrgIdRef.current = currentOrgId;
  }, [currentOrgId]);

  // Transform AuthKit user to our User type
  const user: User | null = authKitUser ? {
    id: authKitUser.id,
    email: authKitUser.email || '',
    firstName: authKitUser.firstName || undefined,
    lastName: authKitUser.lastName || undefined,
    profilePictureUrl: authKitUser.profilePictureUrl || undefined,
  } : null;

  // Fetch org memberships from API when user changes
  const fetchOrgMemberships = useCallback(async () => {
    if (!authKitUser) {
      setUserOrgs([]);
      return;
    }

    try {
      // Fetch org memberships and details via our API
      const response = await fetch('/api/auth/orgs');
      if (response.ok) {
        const data = await response.json();
        const orgs: Organization[] = data.orgs || [];
        setUserOrgs(orgs);

        // Set current org if not set or if current is no longer accessible
        const savedOrgId = currentOrgIdRef.current;
        if (!savedOrgId && orgs.length > 0) {
          setCurrentOrgIdState(orgs[0].id);
        } else if (savedOrgId && !orgs.some(org => org.id === savedOrgId)) {
          if (orgs.length > 0) {
            setCurrentOrgIdState(orgs[0].id);
          } else {
            setCurrentOrgIdState(null);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch org memberships:', error);
    }
  }, [authKitUser, setCurrentOrgIdState]);

  // Initialize when user changes or loading finishes
  useEffect(() => {
    if (!isLoading) {
      if (authKitUser) {
        fetchOrgMemberships().finally(() => {
          setIsInitialized(true);
        });
      } else {
        setUserOrgs([]);
        setIsInitialized(true);
      }
    }
  }, [authKitUser, isLoading, fetchOrgMemberships]);

  const setCurrentOrgId = useCallback((orgId: string) => {
    setCurrentOrgIdState(orgId);
    // Dispatch custom event for cross-component communication
    window.dispatchEvent(new CustomEvent('orgChanged', { detail: { orgId } }));
  }, [setCurrentOrgIdState]);

  const signOut = useCallback(async () => {
    try {
      // Clear local state
      setUserOrgs([]);
      setCurrentOrgIdState(null);

      // Use AuthKit's signOut which handles the full WorkOS session clear
      await authKit.signOut();
    } catch (error) {
      console.error('Sign out error:', error);
      // Fallback: redirect to login
      window.location.href = '/login';
    }
  }, [authKit, setCurrentOrgIdState]);

  const refreshAuth = useCallback(async () => {
    // Refresh the AuthKit session
    await authKit.refreshAuth();
    // Re-fetch org memberships
    await fetchOrgMemberships();
  }, [authKit, fetchOrgMemberships]);

  // Manual sync button action - triggers sync from Convex
  const syncMemberships = useCallback(async () => {
    if (!authKitUser) return;

    try {
      // Call the Convex action to sync memberships
      // This will be called via the Convex client from the component
      // Here we just refresh our local state
      await fetchOrgMemberships();
    } catch (error) {
      console.error('Failed to sync memberships:', error);
      throw error;
    }
  }, [authKitUser, fetchOrgMemberships]);

  const value: AuthContextValue = {
    user,
    userOrgs,
    currentOrgId,
    isInitialized,
    isAuthenticated: !!user,
    setCurrentOrgId,
    signOut,
    refreshAuth,
    syncMemberships,
  };

  return (
    <AuthContext.Provider value={value}>
      <div data-auth-provider style={{ display: 'contents' }}>{children}</div>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Helper hooks
export function useCurrentUser() {
  const { user } = useAuth();
  return user;
}

export function useCurrentOrg() {
  const { userOrgs, currentOrgId } = useAuth();
  if (!currentOrgId) return userOrgs[0] || null;
  return userOrgs.find(org => org.id === currentOrgId) || userOrgs[0] || null;
}

/**
 * Check if current user is admin of the current org
 */
export function useIsOrgAdmin() {
  const { userOrgs, currentOrgId } = useAuth();
  if (!currentOrgId) return false;
  const org = userOrgs.find(org => org.id === currentOrgId);
  return org?.role === ORG_ROLES.ADMIN;
}
