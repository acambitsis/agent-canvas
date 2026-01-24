/**
 * WorkOS API helpers
 *
 * This module contains helper functions for interacting with the WorkOS API.
 * Authentication is handled by @workos-inc/authkit-nextjs SDK.
 * This file contains only member management and org-related API calls.
 */

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
 * Fetch user's organization memberships
 */
export async function fetchUserOrgs(userId: string, apiKey: string): Promise<WorkOSOrgMembership[]> {
  const response = await fetch(
    `https://api.workos.com/user_management/organization_memberships?user_id=${userId}&limit=100`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[WorkOS] fetchUserOrgs failed for user ${userId}: ${response.status} - ${errorText}`);
    return [];
  }
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

/**
 * Result type for WorkOS API operations that can fail
 */
export type WorkOSResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Parse WorkOS API error response
 */
async function parseWorkOSError(response: Response): Promise<string> {
  try {
    const text = await response.text();
    try {
      const json = JSON.parse(text);
      // WorkOS errors typically have a "message" field
      return json.message || json.error || `WorkOS API error: ${response.status}`;
    } catch {
      return text || `WorkOS API error: ${response.status}`;
    }
  } catch {
    return `WorkOS API error: ${response.status}`;
  }
}

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
 * Get user details by ID
 */
export async function getUser(
  userId: string,
  apiKey: string
): Promise<{ id: string; email: string; first_name?: string; last_name?: string; profile_picture_url?: string } | null> {
  const response = await fetch(
    `https://api.workos.com/user_management/users/${userId}`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );

  if (!response.ok) {
    console.error('Failed to get user:', userId, response.status);
    return null;
  }

  return response.json();
}

/**
 * List all members of an organization (with user details)
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
  const memberships = data.data || [];

  // Fetch user details for each membership
  const membersWithUsers = await Promise.all(
    memberships.map(async (membership: WorkOSMember) => {
      const user = await getUser(membership.user_id, apiKey);
      return {
        ...membership,
        user: user || undefined,
      };
    })
  );

  return membersWithUsers;
}

/**
 * Invite a user to an organization
 */
export async function inviteToOrg(
  orgId: string,
  email: string,
  role: string,
  apiKey: string
): Promise<WorkOSResult<{ id: string }>> {
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
    const error = await parseWorkOSError(response);
    console.error('Failed to invite user:', error);
    return { success: false, error };
  }

  const data = await response.json();
  return { success: true, data: { id: data.id } };
}

/**
 * Update a member's role in an organization
 */
export async function updateMemberRole(
  membershipId: string,
  role: string,
  apiKey: string
): Promise<WorkOSResult<void>> {
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
    const error = await parseWorkOSError(response);
    console.error('Failed to update member role:', error);
    return { success: false, error };
  }

  return { success: true, data: undefined };
}

/**
 * Remove a member from an organization
 */
export async function removeMember(
  membershipId: string,
  apiKey: string
): Promise<WorkOSResult<void>> {
  const response = await fetch(
    `https://api.workos.com/user_management/organization_memberships/${membershipId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    }
  );

  if (!response.ok) {
    const error = await parseWorkOSError(response);
    console.error('Failed to remove member:', error);
    return { success: false, error };
  }

  return { success: true, data: undefined };
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
