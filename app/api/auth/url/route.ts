/**
 * POST /api/auth/url
 * Generate WorkOS authorization URL for login
 */

import { createOAuthStateCookie, json } from '@/server/session-utils';

export const runtime = 'edge';

export async function POST(request: Request) {
  const workosClientId = process.env.WORKOS_CLIENT_ID;
  if (!workosClientId) {
    return json({ error: 'WorkOS not configured' }, 500);
  }

  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: workosClientId,
    redirect_uri: `${baseUrl}/api/auth/callback`,
    response_type: 'code',
    provider: 'authkit',
    state,
    scope: 'openid profile email',
  });

  return new Response(JSON.stringify({ url: `https://api.workos.com/user_management/authorize?${params}` }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': createOAuthStateCookie(state),
    },
  });
}
