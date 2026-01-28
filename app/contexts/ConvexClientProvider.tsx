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

// Cooldown to prevent rapid consecutive token refreshes that could cause infinite loops
const REFRESH_COOLDOWN_MS = 2000;

/**
 * Custom hook that adapts WorkOS AuthKit to Convex's useAuth interface.
 * This is passed to ConvexProviderWithAuth to handle token management.
 *
 * Key feature: Properly handles forceRefreshToken when Convex's WebSocket
 * reconnects after being idle, ensuring a fresh token is fetched.
 *
 * Important: Uses refs for token functions to keep fetchAccessToken stable
 * and prevent re-renders from triggering infinite refresh loops. Also includes
 * a cooldown to prevent rapid consecutive refresh calls.
 */
function useAuthForConvex() {
  const { user, loading: authLoading } = useAuthKit();
  const {
    accessToken,
    loading: tokenLoading,
    getAccessToken,
    refresh,
  } = useAccessToken();

  // Use refs for token functions to keep fetchAccessToken stable
  const getAccessTokenRef = useRef(getAccessToken);
  const refreshRef = useRef(refresh);

  // Track last refresh to prevent rapid consecutive refreshes
  // This breaks the loop where refresh() -> state change -> force refresh request
  const lastRefreshTime = useRef<number>(0);

  // Keep refs up to date
  useEffect(() => {
    getAccessTokenRef.current = getAccessToken;
    refreshRef.current = refresh;
  }, [getAccessToken, refresh]);

  // Stable callback that doesn't change on re-renders
  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }): Promise<string | null> => {
      if (forceRefreshToken) {
        const now = Date.now();
        const timeSinceLastRefresh = now - lastRefreshTime.current;

        // If we recently refreshed, return current token to break refresh loops
        // This handles the case where refresh() triggers state changes that
        // cause Convex to immediately request another refresh
        if (timeSinceLastRefresh < REFRESH_COOLDOWN_MS && lastRefreshTime.current > 0) {
          try {
            const token = await getAccessTokenRef.current();
            return token ?? null;
          } catch {
            return null;
          }
        }

        // Convex is requesting a fresh token (e.g., after WebSocket reconnect)
        lastRefreshTime.current = now;

        try {
          const freshToken = await refreshRef.current();
          return freshToken ?? null;
        } catch (error) {
          console.error('[ConvexAuth] Token refresh failed:', error);
          return null;
        }
      }

      // Normal token fetch
      try {
        const token = await getAccessTokenRef.current();
        return token ?? null;
      } catch (error) {
        console.error('[ConvexAuth] getAccessToken failed:', error);
        return null;
      }
    },
    [] // Empty deps - callback is stable, uses refs for latest values
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
