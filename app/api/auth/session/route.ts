/**
 * GET /api/auth/session
 * Get current session info
 */

import { parseSession, json } from '@/server/session-utils';

export const runtime = 'edge';

export async function GET(request: Request) {
  const session = await parseSession(request);
  if (!session) {
    return json({ authenticated: false });
  }

  // Check if token needs refresh (within 10 minutes of expiry or already expired)
  const needsRefresh = session.idTokenExpiresAt
    ? Date.now() > session.idTokenExpiresAt - (10 * 60 * 1000)
    : !session.idToken;

  return json({
    authenticated: true,
    user: session.user,
    orgs: session.orgs || [],
    idToken: session.idToken, // Expose id_token for Convex authentication
    idTokenExpiresAt: session.idTokenExpiresAt, // Token expiry for proactive refresh
    needsRefresh, // Signal client to proactively refresh token
  });
}
