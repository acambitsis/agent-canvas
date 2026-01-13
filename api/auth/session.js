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
  return json({
    authenticated: true,
    user: session.user,
    orgs: session.orgs || [],
  });
}
