/**
 * POST /api/org/[orgId]/invite
 * Invite a user to an organization (admin only)
 */

import { NextResponse } from 'next/server';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { isSuperAdmin, isUserOrgAdmin } from '@/server/org-utils';
import { inviteToOrg } from '@/server/workos';

export async function POST(
  request: Request,
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
    const body = await request.json();
    const { email, role } = body as { email?: string; role?: string };

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Default role to 'member' if not specified
    const memberRole = role || 'member';
    if (memberRole !== 'admin' && memberRole !== 'member') {
      return NextResponse.json({ error: 'Invalid role. Must be "admin" or "member"' }, { status: 400 });
    }

    const result = await inviteToOrg(orgId, email, memberRole, workosApiKey);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      invitationId: result.data.id,
      message: `Invitation sent to ${email}`
    });
  } catch (error) {
    console.error('Error sending invitation:', error);
    return NextResponse.json({ error: 'Failed to send invitation' }, { status: 500 });
  }
}
