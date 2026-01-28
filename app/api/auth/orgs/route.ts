/**
 * GET /api/auth/orgs
 * Get user's organizations with details
 *
 * Uses WorkOS AuthKit SDK for authentication and fetches org details from WorkOS API.
 */

import { NextResponse } from 'next/server';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { fetchUserOrgs, fetchOrgDetails } from '@/server/workos';
import { ORG_ROLES } from '@/types/validationConstants';

export async function GET() {
  // Get the current user from the SDK session
  const { user } = await withAuth();

  if (!user) {
    return NextResponse.json({ orgs: [] });
  }

  const workosApiKey = process.env.WORKOS_API_KEY;
  if (!workosApiKey) {
    return NextResponse.json({ orgs: [] });
  }

  try {
    // Fetch user's org memberships from WorkOS
    const memberships = await fetchUserOrgs(user.id, workosApiKey);

    // Enrich with org details (names)
    const orgs = await Promise.all(
      memberships.map(async (membership) => {
        const orgId = membership.organization_id;
        const role = membership.role?.slug || ORG_ROLES.MEMBER;
        const details = await fetchOrgDetails(orgId, workosApiKey).catch(() => null);
        return {
          id: orgId,
          name: details?.name || orgId,
          role,
        };
      })
    );

    return NextResponse.json({ orgs });
  } catch (error) {
    console.error('Failed to fetch organizations:', error);
    return NextResponse.json({ orgs: [] });
  }
}
