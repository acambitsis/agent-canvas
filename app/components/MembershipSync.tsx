/**
 * MembershipSync - Ensures org memberships are synced to Convex before rendering children
 *
 * This component calls the syncMyMemberships action on mount to ensure the user's
 * org memberships are in the Convex database before any queries that depend on them.
 *
 * Features:
 * - Session caching: Only syncs once per browser session to avoid redundant API calls
 * - Graceful degradation: App still loads if sync fails (user can retry via sidebar)
 * - Stale session handling: Detects auth errors and refreshes token before retrying
 *
 * This is a temporary solution until webhooks are configured for real-time sync.
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAction } from '@/hooks/useConvex';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '../../convex/_generated/api';

/**
 * Check if an error is likely an authentication/token error
 */
function isAuthError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('server error') ||
    message.includes('authentication') ||
    message.includes('unauthorized') ||
    message.includes('unauthenticated') ||
    message.includes('jwt') ||
    message.includes('token')
  );
}

interface MembershipSyncProps {
  children: React.ReactNode;
}

// Session storage key for tracking sync status
const SYNC_CACHE_KEY = 'agentcanvas-membership-synced';
// Cache duration: 5 minutes (sync again after this)
const SYNC_CACHE_DURATION_MS = 5 * 60 * 1000;

/**
 * Check if sync was recently completed (within cache duration)
 */
function wasSyncedRecently(): boolean {
  if (typeof window === 'undefined') return false;

  const cached = sessionStorage.getItem(SYNC_CACHE_KEY);
  if (!cached) return false;

  const timestamp = parseInt(cached, 10);
  if (isNaN(timestamp)) return false;

  return Date.now() - timestamp < SYNC_CACHE_DURATION_MS;
}

/**
 * Mark sync as completed
 */
function markSyncComplete(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(SYNC_CACHE_KEY, Date.now().toString());
}

export function MembershipSync({ children }: MembershipSyncProps) {
  const { isAuthenticated, isInitialized, user, refreshAuth } = useAuth();
  const [syncComplete, setSyncComplete] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const syncMemberships = useAction(api.orgMemberships.syncMyMemberships);
  const syncAttemptedRef = useRef(false);

  useEffect(() => {
    // Only sync if user is authenticated
    if (!isInitialized || !isAuthenticated) {
      // Not authenticated, no sync needed
      if (isInitialized) {
        setSyncComplete(true);
      }
      return;
    }

    // Prevent duplicate sync attempts in strict mode
    if (syncAttemptedRef.current) {
      return;
    }
    syncAttemptedRef.current = true;

    // Check if we already synced recently in this session
    if (wasSyncedRecently()) {
      setSyncComplete(true);
      return;
    }

    // Sync memberships with retry on auth errors (stale session handling)
    let isMounted = true;

    async function doSync(isRetry = false) {
      try {
        await syncMemberships({});
        if (isMounted) {
          markSyncComplete();
          setSyncComplete(true);
        }
      } catch (error) {
        console.error('Failed to sync memberships:', error);

        // If this looks like an auth error and we haven't retried yet,
        // refresh the auth token and try again (handles stale sessions)
        if (!isRetry && isAuthError(error)) {
          console.log('Auth error detected, refreshing token and retrying...');
          try {
            await refreshAuth();
            // Small delay to allow token to propagate
            await new Promise(resolve => setTimeout(resolve, 500));
            if (isMounted) {
              return doSync(true);
            }
          } catch (refreshError) {
            console.error('Failed to refresh auth:', refreshError);
          }
        }

        if (isMounted) {
          // Set error but still allow app to load - queries may fail but user can retry
          setSyncError(error instanceof Error ? error.message : 'Sync failed');
          setSyncComplete(true);
        }
      }
    }

    doSync();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, isInitialized, user, syncMemberships, refreshAuth]);

  // Show loading while syncing
  if (!syncComplete) {
    return (
      <div className="membership-sync-loading">
        <div className="loading-spinner membership-sync-spinner" />
        <p className="membership-sync-text">Loading your workspace...</p>
      </div>
    );
  }

  // Show error if sync failed (but still render children)
  if (syncError) {
    console.warn('Membership sync error (continuing anyway):', syncError);
  }

  return <>{children}</>;
}
