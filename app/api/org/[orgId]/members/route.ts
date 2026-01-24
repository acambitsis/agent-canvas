/**
 * GET /api/org/[orgId]/members
 * List all members of an organization (admin only)
 */

import { NextResponse } from 'next/server';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { isSuperAdmin, isUserOrgAdmin } from '@/server/org-utils';
import { listOrgMembers } from '@/server/workos';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const { user } = await withAuth();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const workosApiKey = process.env.WORKOS_API_KEY;
  if (!workosApiKey) {
    return NextResponse.json({ error: 'WorkOS not configured' }, { status: 500 });
  }

  // Check if caller is admin of this org (or super admin)
  const isAdmin = isSuperAdmin(user.email) || await isUserOrgAdmin(user.id, orgId, workosApiKey);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
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

    return NextResponse.json({ members: formattedMembers });
  } catch (error) {
    console.error('Error listing members:', error);
    return NextResponse.json({ error: 'Failed to list members' }, { status: 500 });
  }
}
