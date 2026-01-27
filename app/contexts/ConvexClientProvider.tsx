/**
 * ConvexClientProvider - Initializes and provides Convex client with authentication
 *
 * Uses WorkOS AuthKit SDK for access tokens with ConvexProviderWithAuth pattern
 * to properly handle token refresh on WebSocket reconnection.
 */

'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { ConvexReactClient, ConvexProviderWithAuth } from 'convex/react';
import { useAuth as useAuthKit, useAccessToken } from '@workos-inc/authkit-nextjs/components';

interface ConvexClientProviderProps {
  children: React.ReactNode;
}

/**
 * Custom hook that adapts WorkOS AuthKit to Convex's useAuth interface.
 * This is passed to ConvexProviderWithAuth to handle token management.
 *
 * Key feature: Properly handles forceRefreshToken when Convex's WebSocket
 * reconnects after being idle, ensuring a fresh token is fetched.
 */
function useAuthForConvex() {
  const { user, loading: authLoading } = useAuthKit();
  const {
    accessToken,
    loading: tokenLoading,
    getAccessToken,
    refresh,
  } = useAccessToken();

  // Track whether we've logged initial state (for debugging)
  const hasLoggedInit = useRef(false);

  // Log auth state changes for debugging
  useEffect(() => {
    if (!hasLoggedInit.current && !authLoading && !tokenLoading) {
      console.log('[ConvexAuth] Auth initialized', {
        isAuthenticated: !!user && !!accessToken,
        hasUser: !!user,
        hasToken: !!accessToken,
      });
      hasLoggedInit.current = true;
    }
  }, [user, accessToken, authLoading, tokenLoading]);

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }): Promise<string | null> => {
      if (forceRefreshToken) {
        // Convex is requesting a fresh token (e.g., after WebSocket reconnect
        // or when server rejected the previous token)
        console.log('[ConvexAuth] Force refreshing token...');
        try {
          // Use refresh() for explicit force refresh
          const freshToken = await refresh();
          console.log('[ConvexAuth] Token refreshed successfully');
          return freshToken ?? null;
        } catch (error) {
          console.error('[ConvexAuth] Token refresh failed:', error);
          // Return null to force re-authentication rather than retrying with
          // a potentially stale token that the server already rejected
          return null;
        }
      }

      // Normal token fetch - getAccessToken handles refresh internally if needed
      const token = accessToken ?? (await getAccessToken());
      return token ?? null;
    },
    [accessToken, getAccessToken, refresh]
  );

  return {
    isLoading: authLoading || tokenLoading,
    isAuthenticated: !!user && !!accessToken,
    fetchAccessToken,
  };
}

export function ConvexClientProvider({ children }: ConvexClientProviderProps) {
  const [client, setClient] = useState<ConvexReactClient | null>(null);

  useEffect(() => {
    async function initClient() {
      try {
        const response = await fetch('/api/config');
        if (response.ok) {
          const config = await response.json();
          if (config.convexUrl) {
            const convexClient = new ConvexReactClient(config.convexUrl);
            setClient(convexClient);
          }
        }
      } catch (error) {
        console.error('Failed to fetch Convex config:', error);
      }
    }

    initClient();
  }, []);

  // Wait for client to be initialized
  if (!client) {
    return <div>Loading Convex...</div>;
  }

  return (
    <ConvexProviderWithAuth client={client} useAuth={useAuthForConvex}>
      {children}
    </ConvexProviderWithAuth>
  );
}
