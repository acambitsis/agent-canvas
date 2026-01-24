/**
 * ConvexClientProvider - Initializes and provides Convex client with authentication
 *
 * Uses WorkOS AuthKit SDK for access tokens.
 */

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { ConvexReactProvider, getConvexClient, setConvexAuth } from '@/hooks/useConvex';
import { ConvexReactClient } from 'convex/react';
import { useAccessToken } from '@workos-inc/authkit-nextjs/components';

interface ConvexClientProviderProps {
  children: React.ReactNode;
}

export function ConvexClientProvider({ children }: ConvexClientProviderProps) {
  const [client, setClient] = useState<ConvexReactClient | null>(null);
  const { accessToken, loading: tokenLoading } = useAccessToken();

  useEffect(() => {
    async function initClient() {
      try {
        const response = await fetch('/api/config');
        if (response.ok) {
          const config = await response.json();
          if (config.convexUrl) {
            const convexClient = getConvexClient(config.convexUrl);
            setClient(convexClient);
          }
        }
      } catch (error) {
        console.error('Failed to fetch Convex config:', error);
      }
    }

    initClient();
  }, []);

  // Create a stable token getter function
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    // If still loading, return null (Convex will retry)
    if (tokenLoading) return null;
    return accessToken || null;
  }, [accessToken, tokenLoading]);

  // Set up auth when client and token are available
  useEffect(() => {
    if (client) {
      setConvexAuth(client, getAccessToken);
    }
  }, [client, getAccessToken]);

  // Wait for client to be initialized
  if (!client) {
    return <div>Loading Convex...</div>;
  }

  return <ConvexReactProvider client={client}>{children}</ConvexReactProvider>;
}
