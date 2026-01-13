/**
 * POST /api/auth/refresh
 * Refresh WorkOS access token using refresh token
 */

import { parseSession, encryptSession, createSessionCookie, json } from '../lib/session-utils.js';

export const config = { runtime: 'edge' };

export default async function handler(request) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const session = await parseSession(request);
  if (!session || !session.refreshToken) {
    return json({ error: 'No refresh token' }, 401);
  }

  const workosClientId = process.env.WORKOS_CLIENT_ID;
  const workosApiKey = process.env.WORKOS_API_KEY;
  if (!workosClientId || !workosApiKey) {
    return json({ error: 'WorkOS not configured' }, 500);
  }

  try {
    // Exchange refresh token for new access token
    const response = await fetch('https://api.workos.com/user_management/authenticate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${workosApiKey}`,
      },
      body: JSON.stringify({
        client_id: workosClientId,
        refresh_token: session.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Token refresh failed:', errorData);
      return json({ error: 'Refresh failed' }, 401);
    }

    const tokenData = await response.json();
    const { access_token, refresh_token } = tokenData;

    // Update session with new tokens, preserve user and org data
    const newSession = {
      ...session,
      accessToken: access_token,
      refreshToken: refresh_token || session.refreshToken, // Keep old if not rotated
    };

    const sessionToken = await encryptSession(newSession);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': createSessionCookie(sessionToken),
      },
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    return json({ error: 'Refresh failed' }, 500);
  }
}
