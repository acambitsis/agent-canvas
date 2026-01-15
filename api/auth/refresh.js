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
      },
      body: JSON.stringify({
        client_id: workosClientId,
        client_secret: workosApiKey,
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
    const { access_token, refresh_token, id_token } = tokenData;

    // id_token is required for Convex authentication
    if (!id_token) {
      console.error('WorkOS did not return id_token on refresh');
      return json({ error: 'Refresh failed - no id_token' }, 401);
    }

    // Calculate token expiry from expires_in if provided, otherwise default to 50 minutes
    const expiresIn = tokenData.expires_in ? parseInt(tokenData.expires_in) * 1000 : 50 * 60 * 1000;
    const idTokenExpiresAt = Date.now() + expiresIn - (10 * 60 * 1000); // Refresh 10 min before expiry

    const newSession = {
      ...session,
      accessToken: access_token,
      refreshToken: refresh_token || session.refreshToken,
      idToken: id_token, // Update id_token for Convex
      idTokenExpiresAt,
    };

    const sessionToken = await encryptSession(newSession);

    return new Response(JSON.stringify({ success: true, idToken: newSession.idToken }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': createSessionCookie(sessionToken)
      }
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    return json({ error: 'Refresh failed' }, 500);
  }
}
