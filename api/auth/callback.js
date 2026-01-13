/**
 * GET /api/auth/callback
 * Handle WorkOS OAuth callback
 */

import { encryptSession, createSessionCookie } from '../lib/session-utils.js';

export const config = { runtime: 'edge' };

function redirect(baseUrl, error) {
  return Response.redirect(`${baseUrl}/login?error=${error}`, 302);
}

async function exchangeCodeForTokens(code, apiKey, clientId) {
  const response = await fetch('https://api.workos.com/user_management/authenticate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      client_id: clientId,
      code,
      grant_type: 'authorization_code',
    }),
  });
  if (!response.ok) {
    const errorData = await response.text();
    console.error('WorkOS token exchange failed:', errorData);
    return null;
  }
  return response.json();
}

async function fetchUserOrgs(userId, apiKey) {
  const response = await fetch(
    `https://api.workos.com/user_management/users/${userId}/organization_memberships`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );
  if (!response.ok) return [];
  const data = await response.json();
  return data.data || [];
}

export default async function handler(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const state = url.searchParams.get('state');
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  if (error) return redirect(baseUrl, error);
  if (!code) return redirect(baseUrl, 'missing_code');

  // Validate OAuth state to prevent CSRF
  const cookies = request.headers.get('Cookie') || '';
  const savedState = cookies.match(/oauth_state=([^;]+)/)?.[1];
  if (!state || state !== savedState) return redirect(baseUrl, 'invalid_state');

  const workosApiKey = process.env.WORKOS_API_KEY;
  const workosClientId = process.env.WORKOS_CLIENT_ID;
  if (!workosApiKey || !workosClientId) {
    return redirect(baseUrl, 'config_error');
  }

  try {
    const tokenData = await exchangeCodeForTokens(code, workosApiKey, workosClientId);
    if (!tokenData) return redirect(baseUrl, 'auth_failed');

    const { user, access_token, refresh_token } = tokenData;
    const orgs = await fetchUserOrgs(user.id, workosApiKey);

    if (orgs.length === 0) {
      return redirect(baseUrl, 'no_organization');
    }

    const sessionData = {
      accessToken: access_token,
      refreshToken: refresh_token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        profilePictureUrl: user.profile_picture_url,
      },
      orgs: orgs.map((om) => ({
        id: om.organization_id,
        role: om.role?.slug || 'member',
      })),
    };

    // Encrypt session data
    const sessionToken = await encryptSession(sessionData);

    return new Response(null, {
      status: 302,
      headers: [
        ['Location', baseUrl],
        ['Set-Cookie', createSessionCookie(sessionToken)],
        ['Set-Cookie', 'oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'],
      ],
    });
  } catch (err) {
    console.error('Auth callback error:', err);
    return redirect(baseUrl, 'auth_failed');
  }
}
