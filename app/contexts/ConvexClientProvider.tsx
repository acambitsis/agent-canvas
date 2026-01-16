/**
 * ConvexClientProvider - Initializes and provides Convex client with authentication
 */

'use client';

import React, { useEffect, useState } from 'react';
import { ConvexReactProvider, getConvexClient, setConvexAuth } from '@/hooks/useConvex';
import { ConvexReactClient } from 'convex/react';
import { useIdToken } from './AuthContext';

interface ConvexClientProviderProps {
  children: React.ReactNode;
}

export function ConvexClientProvider({ children }: ConvexClientProviderProps) {
  const [client, setClient] = useState<ConvexReactClient | null>(null);
  const getIdToken = useIdToken();

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

  // Set up auth when client and token are available
  useEffect(() => {
    if (client && getIdToken) {
      setConvexAuth(client, getIdToken);
    }
  }, [client, getIdToken]);

  if (!client) {
    return <div>Loading...</div>;
  }

  return <ConvexReactProvider client={client}>{children}</ConvexReactProvider>;
}
