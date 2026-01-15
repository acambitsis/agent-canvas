/**
 * GET /api/auth/callback
 * Handle WorkOS OAuth callback
 */

import { clearOAuthStateCookie, createSessionCookie, encryptSession, generateIdToken } from '../lib/session-utils.js';

export const config = { runtime: 'edge' };

function redirect(baseUrl, error) {
  // Encode error to prevent query string injection
  const encodedError = encodeURIComponent(error);
  return Response.redirect(`${baseUrl}/login?error=${encodedError}`, 302);
}

async function exchangeCodeForTokens(code, apiKey, clientId) {
  const response = await fetch('https://api.workos.com/user_management/authenticate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: apiKey,
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
    `https://api.workos.com/user_management/organization_memberships?user_id=${userId}`,
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

    const { user, access_token, refresh_token, id_token } = tokenData;

    // Debug: log what WorkOS returned
    console.log('WorkOS token response keys:', Object.keys(tokenData));
    console.log('WorkOS returned id_token:', !!id_token, 'length:', id_token?.length || 0);

    // Use WorkOS id_token if provided, otherwise generate our own JWT for Convex
    let idTokenForConvex = id_token;
    if (!idTokenForConvex) {
      console.log('WorkOS did not return id_token - generating custom JWT for Convex');
      idTokenForConvex = await generateIdToken(user);
      console.log('Generated custom id_token, length:', idTokenForConvex.length);
    }

    const orgs = await fetchUserOrgs(user.id, workosApiKey);

    if (orgs.length === 0) {
      return redirect(baseUrl, 'no_organization');
    }

    // Calculate token expiry from expires_in if provided, otherwise default to 50 minutes
    // id_token typically expires in 1 hour, refresh proactively at 50 minutes
    const expiresIn = tokenData.expires_in ? parseInt(tokenData.expires_in) * 1000 : 50 * 60 * 1000;
    const idTokenExpiresAt = Date.now() + expiresIn - (10 * 60 * 1000); // Refresh 10 min before expiry

    const sessionData = {
      accessToken: access_token, // Keep for WorkOS API calls if needed
      refreshToken: refresh_token,
      idToken: idTokenForConvex, // JWT token for Convex authentication (WorkOS or custom)
      idTokenExpiresAt,
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

    // Use Headers object to properly handle multiple Set-Cookie headers
    const headers = new Headers();
    headers.set('Location', baseUrl);
    headers.append('Set-Cookie', createSessionCookie(sessionToken));
    headers.append('Set-Cookie', clearOAuthStateCookie());

    return new Response(null, {
      status: 302,
      headers,
    });
  } catch (err) {
    console.error('Auth callback error:', err);
    return redirect(baseUrl, 'auth_failed');
  }
}
