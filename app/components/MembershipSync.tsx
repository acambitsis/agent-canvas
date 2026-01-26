/**
 * MembershipSync - Ensures org memberships are synced to Convex before rendering children
 *
 * This component calls the syncMyMemberships action on mount to ensure the user's
 * org memberships are in the Convex database before any queries that depend on them.
 *
 * Features:
 * - User-specific sync: Tracks which user we've synced for, resets on user change
 * - Session caching: Only syncs once per user per browser session (with cache key per user)
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

// Session storage key prefix for tracking sync status (per-user)
const SYNC_CACHE_KEY_PREFIX = 'agentcanvas-membership-synced-';
// Cache duration: 5 minutes (sync again after this)
const SYNC_CACHE_DURATION_MS = 5 * 60 * 1000;

/**
 * Get the cache key for a specific user
 */
function getSyncCacheKey(userId: string): string {
  return `${SYNC_CACHE_KEY_PREFIX}${userId}`;
}

/**
 * Check if sync was recently completed for a specific user (within cache duration)
 */
function wasSyncedRecentlyForUser(userId: string): boolean {
  if (typeof window === 'undefined') return false;

  const cached = sessionStorage.getItem(getSyncCacheKey(userId));
  if (!cached) return false;

  const timestamp = parseInt(cached, 10);
  if (isNaN(timestamp)) return false;

  return Date.now() - timestamp < SYNC_CACHE_DURATION_MS;
}

/**
 * Mark sync as completed for a specific user
 */
function markSyncCompleteForUser(userId: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(getSyncCacheKey(userId), Date.now().toString());
}

export function MembershipSync({ children }: MembershipSyncProps) {
  const { isAuthenticated, isInitialized, user, refreshAuth } = useAuth();
  // Track which user ID we've completed sync for (null = not synced or logged out)
  const [syncedForUserId, setSyncedForUserId] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const syncMemberships = useAction(api.orgMemberships.syncMyMemberships);
  // Track sync attempts per user to prevent duplicates in strict mode
  const syncAttemptedForUserRef = useRef<string | null>(null);

  const currentUserId = user?.id || null;

  useEffect(() => {
    // Not initialized yet - wait
    if (!isInitialized) {
      return;
    }

    // Not authenticated - reset sync state (user logged out or not logged in)
    if (!isAuthenticated || !currentUserId) {
      setSyncedForUserId(null);
      setSyncError(null);
      syncAttemptedForUserRef.current = null;
      return;
    }

    // Already synced for this user
    if (syncedForUserId === currentUserId) {
      return;
    }

    // Prevent duplicate sync attempts for same user in strict mode
    if (syncAttemptedForUserRef.current === currentUserId) {
      return;
    }
    syncAttemptedForUserRef.current = currentUserId;

    // Check if we already synced recently for this user in this session
    if (wasSyncedRecentlyForUser(currentUserId)) {
      setSyncedForUserId(currentUserId);
      return;
    }

    // Sync memberships with retry on auth errors (stale session handling)
    let isMounted = true;

    async function doSync(isRetry = false) {
      try {
        await syncMemberships({});
        if (isMounted && currentUserId) {
          markSyncCompleteForUser(currentUserId);
          setSyncedForUserId(currentUserId);
          setSyncError(null);
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

        if (isMounted && currentUserId) {
          // Set error but still allow app to load - queries may fail but user can retry
          setSyncError(error instanceof Error ? error.message : 'Sync failed');
          // Mark as synced even on error to allow app to load (graceful degradation)
          setSyncedForUserId(currentUserId);
        }
      }
    }

    doSync();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, isInitialized, currentUserId, syncedForUserId, syncMemberships, refreshAuth]);

  // Determine if we should show loading state
  // Show loading when:
  // 1. Auth not initialized yet, OR
  // 2. User is authenticated but we haven't synced for them yet
  const shouldShowLoading = !isInitialized ||
    (isAuthenticated && currentUserId && syncedForUserId !== currentUserId);

  if (shouldShowLoading) {
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
