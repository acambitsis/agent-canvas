/**
 * WorkOS API helpers
 */

export interface WorkOSTokenResponse {
  access_token: string;
  refresh_token: string;
  id_token?: string;
  expires_in?: number;
  user: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
    profile_picture_url?: string;
  };
}

export interface WorkOSOrgMembership {
  organization_id: string;
  role?: {
    slug: string;
  };
}

export interface WorkOSOrg {
  id: string;
  name: string;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  apiKey: string,
  clientId: string
): Promise<WorkOSTokenResponse | null> {
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

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
  refreshToken: string,
  apiKey: string,
  clientId: string
): Promise<WorkOSTokenResponse | null> {
  const response = await fetch('https://api.workos.com/user_management/authenticate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: apiKey,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error('Token refresh failed:', errorData);
    return null;
  }

  return response.json();
}

/**
 * Fetch user's organization memberships
 */
export async function fetchUserOrgs(userId: string, apiKey: string): Promise<WorkOSOrgMembership[]> {
  const response = await fetch(
    `https://api.workos.com/user_management/organization_memberships?user_id=${userId}`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );
  if (!response.ok) return [];
  const data = await response.json();
  return data.data || [];
}

/**
 * Fetch organization details by ID
 */
export async function fetchOrgDetails(orgId: string, apiKey: string): Promise<WorkOSOrg | null> {
  const response = await fetch(`https://api.workos.com/organizations/${orgId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) return null;
  return response.json();
}
