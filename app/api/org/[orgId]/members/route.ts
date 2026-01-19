/**
 * GET /api/org/[orgId]/members
 * List all members of an organization (admin only)
 */

import { parseSession, json } from '@/server/session-utils';
import { isSessionOrgAdmin } from '@/server/org-utils';
import { listOrgMembers } from '@/server/workos';

export const runtime = 'edge';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const session = await parseSession(request);

  if (!session) {
    return json({ error: 'Unauthorized' }, 401);
  }

  // Check if caller is admin of this org (or super admin)
  if (!isSessionOrgAdmin(session, orgId)) {
    return json({ error: 'Admin access required' }, 403);
  }

  const workosApiKey = process.env.WORKOS_API_KEY;
  if (!workosApiKey) {
    return json({ error: 'WorkOS not configured' }, 500);
  }

  try {
    const members = await listOrgMembers(orgId, workosApiKey);

    // Transform to a cleaner format for the frontend
    const formattedMembers = members.map((member) => ({
      id: member.id, // membership ID
      userId: member.user_id,
      email: member.user?.email || '',
      firstName: member.user?.first_name || '',
      lastName: member.user?.last_name || '',
      profilePictureUrl: member.user?.profile_picture_url || '',
      role: member.role?.slug || 'member',
      status: member.status,
      createdAt: member.created_at,
    }));

    return json({ members: formattedMembers });
  } catch (error) {
    console.error('Error listing members:', error);
    return json({ error: 'Failed to list members' }, 500);
  }
}
