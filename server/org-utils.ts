/**
 * Organization-related utility functions for API routes
 *
 * Works with WorkOS AuthKit SDK session data.
 * Includes caching to reduce WorkOS API calls for membership checks.
 */

import type { User } from '@workos-inc/node';

/**
 * Session data that includes user and org info
 */
export interface AuthSession {
  user: User | null;
  organizationId?: string;
  role?: string;
}

/**
 * Check if a user is a super admin based on their email
 */
export function isSuperAdmin(email: string | undefined): boolean {
  if (!email) return false;
  const superAdminEmails = process.env.SUPER_ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || [];
  return superAdminEmails.includes(email.toLowerCase());
}

/**
 * Membership cache to reduce WorkOS API calls
 * TTL: 60 seconds - balances freshness with performance
 */
interface CachedMembership {
  memberships: Array<{ organization_id: string; role?: { slug: string } }>;
  expiresAt: number;
}

const membershipCache = new Map<string, CachedMembership>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

/**
 * Get user memberships with caching
 */
async function getCachedMemberships(
  userId: string,
  apiKey: string
): Promise<Array<{ organization_id: string; role?: { slug: string } }>> {
  const cacheKey = userId;
  const cached = membershipCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.memberships;
  }

  const response = await fetch(
    `https://api.workos.com/user_management/organization_memberships?user_id=${userId}&limit=100`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  const memberships = data.data || [];

  // Cache the result
  membershipCache.set(cacheKey, {
    memberships,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return memberships;
}

/**
 * Clear membership cache for a user (call after membership changes)
 */
export function invalidateMembershipCache(userId: string): void {
  membershipCache.delete(userId);
}

/**
 * Check if the user is an admin of the specified organization
 * Uses cached membership data to reduce API calls
 */
export async function isUserOrgAdmin(
  userId: string,
  orgId: string,
  apiKey: string
): Promise<boolean> {
  const memberships = await getCachedMemberships(userId, apiKey);
  const membership = memberships.find(
    (m) => m.organization_id === orgId
  );

  return membership?.role?.slug === 'admin';
}

/**
 * Check if the user has any access to the specified organization
 * Uses cached membership data to reduce API calls
 */
export async function hasUserOrgAccess(
  userId: string,
  orgId: string,
  apiKey: string
): Promise<boolean> {
  const memberships = await getCachedMemberships(userId, apiKey);
  return memberships.some(
    (m) => m.organization_id === orgId
  );
}
