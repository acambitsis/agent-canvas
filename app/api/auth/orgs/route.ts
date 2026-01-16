/**
 * GET /api/auth/orgs
 * Get user's organizations from session
 */

import { parseSession, json } from '@/server/session-utils';
import { fetchOrgDetails } from '@/server/workos';

export const runtime = 'edge';

export async function GET(request: Request) {
  const session = await parseSession(request);
  if (!session) {
    return json({ organizations: [] });
  }

  const orgs = session.orgs || [];

  // If orgs already have names, return as-is
  if (orgs.length === 0 || orgs[0].name) {
    return json({ organizations: orgs });
  }

  // Enrich orgs with names from WorkOS API
  const workosApiKey = process.env.WORKOS_API_KEY;
  if (!workosApiKey) {
    return json({ organizations: orgs });
  }

  const enrichedOrgs = await Promise.all(
    orgs.map(async (org) => {
      const details = await fetchOrgDetails(org.id, workosApiKey).catch(() => null);
      return details ? { id: org.id, name: details.name, role: org.role } : org;
    })
  );

  return json({ organizations: enrichedOrgs });
}
