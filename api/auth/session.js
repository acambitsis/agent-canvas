/**
 * GET /api/auth/session
 * Get current session info
 */

import { parseSession, json } from '../lib/session-utils.js';

export const config = { runtime: 'edge' };

export default async function handler(request) {
  const session = await parseSession(request);
  if (!session) {
    return json({ authenticated: false });
  }

  // Check if id_token needs refresh (within 10 minutes of expiry)
  const needsRefresh = session.idTokenExpiresAt
    ? Date.now() > session.idTokenExpiresAt
    : !session.idToken; // Missing id_token needs refresh

  return json({
    authenticated: true,
    user: session.user,
    orgs: session.orgs || [],
    idToken: session.idToken, // Expose id_token for Convex authentication
    needsRefresh,
  });
}
