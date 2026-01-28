/**
 * Convex client setup for React
 * Re-exports Convex React hooks for convenience
 */

import {
  ConvexProvider as ConvexReactProvider,
  useQuery,
  useMutation,
  useAction,
  useConvexAuth,
} from 'convex/react';

// Re-export Convex React hooks for convenience
export { useQuery, useMutation, useAction, useConvexAuth, ConvexReactProvider };
