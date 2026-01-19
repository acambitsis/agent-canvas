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

// ============================================================================
// Member Management Types and Helpers
// ============================================================================

export interface WorkOSMember {
  id: string; // membership ID
  user_id: string;
  organization_id: string;
  status: string;
  role?: {
    slug: string;
  };
  user?: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
    profile_picture_url?: string;
  };
  created_at: string;
  updated_at: string;
}

export interface WorkOSInvitation {
  id: string;
  email: string;
  state: string;
  organization_id: string;
  created_at: string;
  expires_at: string;
}

/**
 * List all members of an organization
 */
export async function listOrgMembers(
  orgId: string,
  apiKey: string
): Promise<WorkOSMember[]> {
  const response = await fetch(
    `https://api.workos.com/user_management/organization_memberships?organization_id=${orgId}`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );

  if (!response.ok) {
    console.error('Failed to list org members:', response.status);
    return [];
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * Invite a user to an organization
 */
export async function inviteToOrg(
  orgId: string,
  email: string,
  role: string,
  apiKey: string
): Promise<{ id: string } | null> {
  const response = await fetch('https://api.workos.com/user_management/invitations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      email,
      organization_id: orgId,
      role_slug: role,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Failed to invite user:', error);
    return null;
  }

  const data = await response.json();
  return { id: data.id };
}

/**
 * Update a member's role in an organization
 */
export async function updateMemberRole(
  membershipId: string,
  role: string,
  apiKey: string
): Promise<boolean> {
  const response = await fetch(
    `https://api.workos.com/user_management/organization_memberships/${membershipId}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        role_slug: role,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('Failed to update member role:', error);
    return false;
  }

  return true;
}

/**
 * Remove a member from an organization
 */
export async function removeMember(
  membershipId: string,
  apiKey: string
): Promise<boolean> {
  const response = await fetch(
    `https://api.workos.com/user_management/organization_memberships/${membershipId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('Failed to remove member:', error);
    return false;
  }

  return true;
}

/**
 * Get a single organization membership by ID
 */
export async function getMembership(
  membershipId: string,
  apiKey: string
): Promise<WorkOSMember | null> {
  const response = await fetch(
    `https://api.workos.com/user_management/organization_memberships/${membershipId}`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );

  if (!response.ok) return null;
  return response.json();
}
