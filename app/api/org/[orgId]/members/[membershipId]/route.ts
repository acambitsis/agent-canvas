/**
 * PATCH/DELETE /api/org/[orgId]/members/[membershipId]
 * Update member role or remove member (admin only)
 */

import { NextResponse } from 'next/server';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { isSuperAdmin, isUserOrgAdmin } from '@/server/org-utils';
import { updateMemberRole, removeMember, getMembership } from '@/server/workos';

/**
 * PATCH - Update member's role
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgId: string; membershipId: string }> }
) {
  const { orgId, membershipId } = await params;
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
    // Verify the membership belongs to this org
    const membership = await getMembership(membershipId, workosApiKey);
    if (!membership || membership.organization_id !== orgId) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 });
    }

    const body = await request.json();
    const { role } = body as { role?: string };

    if (!role || typeof role !== 'string') {
      return NextResponse.json({ error: 'Role is required' }, { status: 400 });
    }

    if (role !== 'admin' && role !== 'member') {
      return NextResponse.json({ error: 'Invalid role. Must be "admin" or "member"' }, { status: 400 });
    }

    // Prevent demoting yourself if you're the only admin
    if (membership.user_id === user.id && role !== 'admin') {
      return NextResponse.json({
        error: 'Cannot change your own role. Ask another admin to do this.'
      }, { status: 400 });
    }

    const result = await updateMemberRole(membershipId, role, workosApiKey);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, role });
  } catch (error) {
    console.error('Error updating member role:', error);
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
  }
}

/**
 * DELETE - Remove member from organization
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ orgId: string; membershipId: string }> }
) {
  const { orgId, membershipId } = await params;
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
    // Verify the membership belongs to this org
    const membership = await getMembership(membershipId, workosApiKey);
    if (!membership || membership.organization_id !== orgId) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 });
    }

    // Prevent removing yourself
    if (membership.user_id === user.id) {
      return NextResponse.json({ error: 'Cannot remove yourself from the organization' }, { status: 400 });
    }

    const result = await removeMember(membershipId, workosApiKey);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing member:', error);
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
  }
}
