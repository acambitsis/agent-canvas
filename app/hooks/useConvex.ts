/**
 * Convex client setup for React
 * Uses official Convex React provider pattern
 */

import { useMemo } from 'react';
import { ConvexProvider as ConvexReactProvider, useQuery, useMutation, useAction } from 'convex/react';
import { ConvexReactClient } from 'convex/react';

let globalClient: ConvexReactClient | null = null;

/**
 * Get or create the global Convex client
 */
export function getConvexClient(convexUrl: string): ConvexReactClient {
  if (!globalClient) {
    globalClient = new ConvexReactClient(convexUrl);
  }
  return globalClient;
}

/**
 * Set auth on the client
 */
export function setConvexAuth(client: ConvexReactClient, getIdToken: () => string | null) {
  client.setAuth(async () => {
    const token = getIdToken();
    if (!token) {
      throw new Error('No authentication token available');
    }
    return token;
  });
}

/**
 * Clear auth from the client
 */
export function clearConvexAuth(client: ConvexReactClient) {
  client.clearAuth();
}

// Re-export Convex React hooks for convenience
export { useQuery, useMutation, useAction, ConvexReactProvider };
