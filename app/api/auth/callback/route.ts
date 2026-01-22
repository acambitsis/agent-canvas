/**
 * GET /api/auth/callback
 * Handle WorkOS OAuth callback
 */

import {
  clearOAuthStateCookie,
  createSessionCookie,
  encryptSession,
  getIdTokenForConvex,
  checkSuperAdmin,
  type SessionData,
  type OrgClaim,
} from '@/server/session-utils';
import { exchangeCodeForTokens, fetchUserOrgs, fetchOrgDetails } from '@/server/workos';
import { ORG_ROLES } from '@/types/validationConstants';

export const runtime = 'edge';

function redirect(baseUrl: string, error: string): Response {
  // Encode error to prevent query string injection
  const encodedError = encodeURIComponent(error);
  return Response.redirect(`${baseUrl}/login?error=${encodedError}`, 302);
}

export async function GET(request: Request) {
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
    if (!tokenData) {
      console.error('[Auth Callback] Token exchange failed');
      return redirect(baseUrl, 'auth_failed');
    }

    const { user, access_token, refresh_token } = tokenData;

    // Fetch user's org memberships from WorkOS
    const orgs = await fetchUserOrgs(user.id, workosApiKey);

    // Fetch org details to get names, then convert to OrgClaim format
    const orgDetails = await Promise.all(
      orgs.map(async (om) => {
        const details = await fetchOrgDetails(om.organization_id, workosApiKey);
        return {
          id: om.organization_id,
          role: om.role?.slug || ORG_ROLES.MEMBER,
          name: details?.name,
        };
      })
    );

    // OrgClaims for JWT (without name to keep token smaller)
    const orgClaims: OrgClaim[] = orgDetails.map((org) => ({
      id: org.id,
      role: org.role,
    }));

    // Generate custom JWT with orgs and isSuperAdmin claims for Convex
    const idTokenForConvex = await getIdTokenForConvex(user, orgClaims);

    if (orgs.length === 0) {
      console.error(`[Auth Callback] User ${user.email} has no org memberships - check WorkOS invitation status`);
      return redirect(baseUrl, 'no_organization');
    }

    // Calculate token expiry from expires_in if provided, otherwise default to 50 minutes
    // id_token typically expires in 1 hour, refresh proactively at 50 minutes
    const expiresIn = tokenData.expires_in ? parseInt(String(tokenData.expires_in)) * 1000 : 50 * 60 * 1000;
    const idTokenExpiresAt = Date.now() + expiresIn - (10 * 60 * 1000); // Refresh 10 min before expiry

    const sessionData: SessionData = {
      accessToken: access_token, // Keep for WorkOS API calls if needed
      refreshToken: refresh_token,
      idToken: idTokenForConvex, // JWT token for Convex authentication with orgs claims
      idTokenExpiresAt,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        profilePictureUrl: user.profile_picture_url,
      },
      orgs: orgDetails, // Include org names for display
      isSuperAdmin: checkSuperAdmin(user.email),
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
