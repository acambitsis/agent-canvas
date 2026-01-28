/**
 * Organization-related utility functions for API routes
 *
 * Works with WorkOS AuthKit SDK session data.
 * Includes caching to reduce WorkOS API calls for membership checks.
 */

import { ORG_ROLES } from '@/types/validationConstants';

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
 * Get user memberships with caching (internal)
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

  return membership?.role?.slug === ORG_ROLES.ADMIN;
}
