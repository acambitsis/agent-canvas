/**
 * Organization-related utility functions for API routes
 */

import type { SessionData } from './session-utils';

/**
 * Check if the session user is an admin of the specified organization
 * Also returns true for super admins (they have admin access to all orgs)
 */
export function isSessionOrgAdmin(
  session: Pick<SessionData, 'orgs'> & { isSuperAdmin?: boolean },
  orgId: string
): boolean {
  // Super admins have admin access to all orgs
  if (session.isSuperAdmin) {
    return true;
  }
  const membership = session.orgs.find((org) => org.id === orgId);
  return membership?.role === 'admin';
}

/**
 * Check if the session user has any access to the specified organization
 * (either as a member or super admin)
 */
export function hasSessionOrgAccess(
  session: Pick<SessionData, 'orgs'> & { isSuperAdmin?: boolean },
  orgId: string
): boolean {
  if (session.isSuperAdmin) {
    return true;
  }
  return session.orgs.some((org) => org.id === orgId);
}
