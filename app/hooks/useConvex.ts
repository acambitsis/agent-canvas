/**
 * Convex client setup for React
 * Uses official Convex React provider pattern
 */

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
 * Set auth on the client with automatic token refresh
 * The getIdToken function should be async and handle token refresh internally
 */
export function setConvexAuth(client: ConvexReactClient, getIdToken: () => Promise<string | null>) {
  client.setAuth(async () => {
    try {
      const token = await getIdToken();
      return token || undefined;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return undefined;
    }
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
