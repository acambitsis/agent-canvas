/**
 * POST /api/auth/refresh
 * Refresh WorkOS access token using refresh token
 */

import {
  parseSession,
  encryptSession,
  createSessionCookie,
  json,
  generateIdToken,
  type SessionData,
} from '@/server/session-utils';
import { refreshAccessToken } from '@/server/workos';

export const runtime = 'edge';

export async function POST(request: Request) {
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
    const tokenData = await refreshAccessToken(session.refreshToken, workosApiKey, workosClientId);

    if (!tokenData) {
      return json({ error: 'Refresh failed' }, 401);
    }

    const { access_token, refresh_token, id_token } = tokenData;

    // Use WorkOS id_token if provided, otherwise generate our own JWT
    // WorkOS typically doesn't return id_token on refresh (standard OIDC behavior)
    let idTokenForConvex = id_token;
    if (!idTokenForConvex) {
      console.log('WorkOS did not return id_token on refresh - generating custom JWT');
      // Use the user data from the existing session to generate a new token
      idTokenForConvex = await generateIdToken(session.user);
    }

    // Calculate token expiry from expires_in if provided, otherwise default to 50 minutes
    const expiresIn = tokenData.expires_in ? parseInt(String(tokenData.expires_in)) * 1000 : 50 * 60 * 1000;
    const idTokenExpiresAt = Date.now() + expiresIn - (10 * 60 * 1000); // Refresh 10 min before expiry

    const newSession: SessionData = {
      ...session,
      accessToken: access_token,
      refreshToken: refresh_token || session.refreshToken,
      idToken: idTokenForConvex, // Update id_token for Convex (WorkOS or custom)
      idTokenExpiresAt,
    };

    const sessionToken = await encryptSession(newSession);

    return new Response(JSON.stringify({ success: true, idToken: newSession.idToken }), {
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
