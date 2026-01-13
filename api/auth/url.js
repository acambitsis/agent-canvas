/**
 * POST /api/auth/url
 * Generate WorkOS authorization URL for login
 */

export const config = { runtime: 'edge' };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async function handler(request) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

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
  });

  return new Response(JSON.stringify({ url: `https://api.workos.com/user_management/authorize?${params}` }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
    },
  });
}
