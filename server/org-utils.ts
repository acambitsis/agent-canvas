/**
 * Organization-related utility functions for API routes
 *
 * Works with WorkOS AuthKit SDK session data.
 */

import type { User } from '@workos-inc/node';

/**
 * Session data that includes user and org info
 */
export interface AuthSession {
  user: User | null;
  organizationId?: string;
  role?: string;
  // We need to check super admin from environment or separate logic
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
 * Check if the user is an admin of the specified organization
 * Note: This requires fetching org memberships from WorkOS API
 */
export async function isUserOrgAdmin(
  userId: string,
  orgId: string,
  apiKey: string
): Promise<boolean> {
  const response = await fetch(
    `https://api.workos.com/user_management/organization_memberships?user_id=${userId}&limit=100`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );

  if (!response.ok) {
    return false;
  }

  const data = await response.json();
  const memberships = data.data || [];
  const membership = memberships.find(
    (m: { organization_id: string; role?: { slug: string } }) => m.organization_id === orgId
  );

  return membership?.role?.slug === 'admin';
}

/**
 * Check if the user has any access to the specified organization
 */
export async function hasUserOrgAccess(
  userId: string,
  orgId: string,
  apiKey: string
): Promise<boolean> {
  const response = await fetch(
    `https://api.workos.com/user_management/organization_memberships?user_id=${userId}&limit=100`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );

  if (!response.ok) {
    return false;
  }

  const data = await response.json();
  const memberships = data.data || [];
  return memberships.some(
    (m: { organization_id: string }) => m.organization_id === orgId
  );
}
