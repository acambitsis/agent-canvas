/**
 * AuthContext - Manages user authentication and organization state
 */

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { User, Organization, SessionData } from '@/types/auth';
import { useLocalStorage } from '@/hooks/useLocalStorage';

const CURRENT_ORG_KEY = 'agentcanvas-current-org';

// Module-level flag to prevent double-initialization in React Strict Mode
let authInitialized = false;

interface AuthContextValue {
  user: User | null;
  userOrgs: Organization[];
  currentOrgId: string | null;
  idToken: string | null;
  idTokenExpiresAt: number | null;
  isInitialized: boolean;
  isAuthenticated: boolean;
  setCurrentOrgId: (orgId: string) => void;
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userOrgs, setUserOrgs] = useState<Organization[]>([]);
  const [currentOrgId, setCurrentOrgIdState] = useLocalStorage<string | null>(CURRENT_ORG_KEY, null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [idTokenExpiresAt, setIdTokenExpiresAt] = useState<number | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const currentOrgIdRef = useRef(currentOrgId);
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    currentOrgIdRef.current = currentOrgId;
  }, [currentOrgId]);

  // Internal refresh implementation with retry logic
  const doRefresh = useCallback(async (retryCount = 0): Promise<string | null> => {
    try {
      const refreshResponse = await fetch('/api/auth/refresh', { method: 'POST' });

      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        if (refreshData.idToken) {
          setIdToken(refreshData.idToken);
          // Use server-provided expiry, fallback to 50 minutes
          const expiry = refreshData.idTokenExpiresAt || (Date.now() + (50 * 60 * 1000));
          setIdTokenExpiresAt(expiry);
          return refreshData.idToken;
        }
      }

      // 401 means invalid refresh token - must re-login
      if (refreshResponse.status === 401) {
        console.warn('Refresh token invalid, redirecting to login');
        window.location.href = '/login';
        return null;
      }

      // Other errors (500, network issues) - retry once
      if (retryCount < 1) {
        console.warn(`Token refresh failed (status ${refreshResponse.status}), retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return doRefresh(retryCount + 1);
      }

      // Retry exhausted - redirect to login
      console.error('Token refresh failed after retry, redirecting to login');
      window.location.href = '/login';
      return null;
    } catch (error) {
      // Network error - retry once
      if (retryCount < 1) {
        console.warn('Token refresh network error, retrying...', error);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return doRefresh(retryCount + 1);
      }

      console.error('Token refresh failed after retry:', error);
      window.location.href = '/login';
      return null;
    }
  }, []);

  // Refresh token with concurrent call coalescing
  // Multiple callers will share the same refresh promise
  const refreshToken = useCallback(async (): Promise<string | null> => {
    // If a refresh is already in progress, wait for it
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    // Start new refresh and store the promise
    refreshPromiseRef.current = doRefresh().finally(() => {
      refreshPromiseRef.current = null;
    });

    return refreshPromiseRef.current;
  }, [doRefresh]);

  const refreshAuth = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/session');
      const data: SessionData = await response.json();

      if (data.authenticated && data.user) {
        setUser(data.user);
        setUserOrgs(data.orgs || []);
        setIdToken(data.idToken || null);
        setIdTokenExpiresAt(data.idTokenExpiresAt || null);

        // Set current org from preference or first available (use ref to avoid dependency issues)
        const savedOrgId = currentOrgIdRef.current;
        if (!savedOrgId && data.orgs && data.orgs.length > 0) {
          setCurrentOrgIdState(data.orgs[0].id);
        } else if (savedOrgId && !data.orgs?.some(org => org.id === savedOrgId)) {
          // Current org no longer accessible, switch to first available
          if (data.orgs && data.orgs.length > 0) {
            setCurrentOrgIdState(data.orgs[0].id);
          } else {
            setCurrentOrgIdState(null);
          }
        }

        // Proactively refresh token if needed
        if (data.needsRefresh) {
          await refreshToken();
        }

        // If still no idToken, force re-authentication
        if (!data.idToken && !data.needsRefresh) {
          console.warn('No idToken available - forcing re-authentication');
          setUser(null);
          setUserOrgs([]);
          setIdToken(null);
          setIdTokenExpiresAt(null);
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
      setIdTokenExpiresAt(null);
    } finally {
      setIsInitialized(true);
    }
  }, [setCurrentOrgIdState, refreshToken]);

  // Initialize auth on mount (only once, even across React Strict Mode remounts)
  useEffect(() => {
    if (authInitialized) return;
    authInitialized = true;
    refreshAuth();

    // Reset flag on unmount so navigation back to this page works
    return () => {
      // Only reset after a delay to handle Strict Mode's quick unmount/remount
      setTimeout(() => {
        if (!document.querySelector('[data-auth-provider]')) {
          authInitialized = false;
        }
      }, 100);
    };
  }, [refreshAuth]);

  // Proactive background token refresh - refresh 5 minutes before expiry
  useEffect(() => {
    if (!idTokenExpiresAt || !isInitialized) return;

    const checkAndRefresh = () => {
      const now = Date.now();
      const timeUntilExpiry = idTokenExpiresAt - now;

      // Refresh if token expires in less than 5 minutes
      if (timeUntilExpiry < 5 * 60 * 1000) {
        refreshToken();
      }
    };

    // Check every 2 minutes
    const interval = setInterval(checkAndRefresh, 2 * 60 * 1000);

    // Also check immediately in case we're already close to expiry
    checkAndRefresh();

    return () => clearInterval(interval);
  }, [idTokenExpiresAt, isInitialized, refreshToken]);

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
      setIdTokenExpiresAt(null);
      setCurrentOrgIdState(null);
      window.location.href = '/login';
    }
  }, [setCurrentOrgIdState]);

  const value: AuthContextValue = {
    user,
    userOrgs,
    currentOrgId,
    idToken,
    idTokenExpiresAt,
    isInitialized,
    isAuthenticated: !!user,
    setCurrentOrgId,
    signOut,
    refreshAuth,
    refreshToken,
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
 * Hook for getting an ID token with automatic refresh.
 * Returns a function that checks expiry and refreshes if needed.
 */
export function useIdToken() {
  const { idToken, idTokenExpiresAt, refreshToken } = useAuth();

  // Return a function that gets a fresh token, refreshing if expired
  return useCallback(async (): Promise<string | null> => {
    // If no token, return null
    if (!idToken) return null;

    // Check if token is expired or about to expire (within 2 minutes)
    const now = Date.now();
    const isExpired = idTokenExpiresAt && now > idTokenExpiresAt - (2 * 60 * 1000);

    if (isExpired) {
      // Token expired - refresh and return new token
      const newToken = await refreshToken();
      return newToken;
    }

    // Token is still valid
    return idToken;
  }, [idToken, idTokenExpiresAt, refreshToken]);
}

/**
 * Check if current user is admin of the current org
 */
export function useIsOrgAdmin() {
  const { userOrgs, currentOrgId } = useAuth();
  if (!currentOrgId) return false;
  const org = userOrgs.find(org => org.id === currentOrgId);
  return org?.role === 'admin';
}
