/**
 * AuthContext - Manages user authentication and organization state
 */

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, Organization, SessionData } from '@/types/auth';
import { useLocalStorage } from '@/hooks/useLocalStorage';

const CURRENT_ORG_KEY = 'agentcanvas-current-org';

interface AuthContextValue {
  user: User | null;
  userOrgs: Organization[];
  currentOrgId: string | null;
  idToken: string | null;
  isInitialized: boolean;
  isAuthenticated: boolean;
  setCurrentOrgId: (orgId: string) => void;
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userOrgs, setUserOrgs] = useState<Organization[]>([]);
  const [currentOrgId, setCurrentOrgIdState] = useLocalStorage<string | null>(CURRENT_ORG_KEY, null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const refreshAuth = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/session');
      const data: SessionData = await response.json();

      if (data.authenticated && data.user) {
        setUser(data.user);
        setUserOrgs(data.orgs || []);
        setIdToken(data.idToken || null);

        // Set current org from preference or first available
        if (!currentOrgId && data.orgs && data.orgs.length > 0) {
          setCurrentOrgIdState(data.orgs[0].id);
        } else if (currentOrgId && !data.orgs?.some(org => org.id === currentOrgId)) {
          // Current org no longer accessible, switch to first available
          if (data.orgs && data.orgs.length > 0) {
            setCurrentOrgIdState(data.orgs[0].id);
          } else {
            setCurrentOrgIdState(null);
          }
        }

        // Proactively refresh token if needed
        if (data.needsRefresh) {
          try {
            const refreshResponse = await fetch('/api/auth/refresh', { method: 'POST' });
            if (refreshResponse.ok) {
              const refreshData = await refreshResponse.json();
              if (refreshData.idToken) {
                setIdToken(refreshData.idToken);
              }
            }
          } catch (error) {
            console.error('Token refresh failed:', error);
          }
        }

        // If still no idToken, force re-authentication
        if (!data.idToken && !data.needsRefresh) {
          console.warn('No idToken available - forcing re-authentication');
          setUser(null);
          setUserOrgs([]);
          setIdToken(null);
          window.location.href = '/login';
          return;
        }
      } else {
        // Not authenticated, redirect to login
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      setUser(null);
      setUserOrgs([]);
      setIdToken(null);
    } finally {
      setIsInitialized(true);
    }
  }, [currentOrgId, setCurrentOrgIdState]);

  // Initialize auth on mount
  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  const setCurrentOrgId = useCallback((orgId: string) => {
    setCurrentOrgIdState(orgId);
    // Dispatch custom event for cross-component communication
    window.dispatchEvent(new CustomEvent('orgChanged', { detail: { orgId } }));
  }, [setCurrentOrgIdState]);

  const signOut = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      setUser(null);
      setUserOrgs([]);
      setIdToken(null);
      setCurrentOrgIdState(null);
      window.location.href = '/login';
    }
  }, [setCurrentOrgIdState]);

  const value: AuthContextValue = {
    user,
    userOrgs,
    currentOrgId,
    idToken,
    isInitialized,
    isAuthenticated: !!user,
    setCurrentOrgId,
    signOut,
    refreshAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
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

export function useIdToken() {
  const { idToken } = useAuth();
  return useCallback(() => idToken, [idToken]);
}
