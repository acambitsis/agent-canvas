/**
 * GET /api/auth/orgs
 * Get user's organizations from session
 */

import { parseSession, json } from '../lib/session-utils.js';

export const config = { runtime: 'edge' };

async function fetchOrgDetails(orgId, apiKey) {
  const response = await fetch(`https://api.workos.com/organizations/${orgId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) return null;
  return response.json();
}

export default async function handler(request) {
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
