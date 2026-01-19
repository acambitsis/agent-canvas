/**
 * PATCH/DELETE /api/org/[orgId]/members/[membershipId]
 * Update member role or remove member (admin only)
 */

import { parseSession, json } from '@/server/session-utils';
import { isSessionOrgAdmin } from '@/server/org-utils';
import { updateMemberRole, removeMember, getMembership } from '@/server/workos';

export const runtime = 'edge';

/**
 * PATCH - Update member's role
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgId: string; membershipId: string }> }
) {
  const { orgId, membershipId } = await params;
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
    // Verify the membership belongs to this org
    const membership = await getMembership(membershipId, workosApiKey);
    if (!membership || membership.organization_id !== orgId) {
      return json({ error: 'Membership not found' }, 404);
    }

    const body = await request.json();
    const { role } = body as { role?: string };

    if (!role || typeof role !== 'string') {
      return json({ error: 'Role is required' }, 400);
    }

    if (role !== 'admin' && role !== 'member') {
      return json({ error: 'Invalid role. Must be "admin" or "member"' }, 400);
    }

    // Prevent demoting yourself if you're the only admin
    if (membership.user_id === session.user.id && role !== 'admin') {
      // Note: This is a simple check - in production you might want to
      // verify there's at least one other admin before allowing this
      return json({
        error: 'Cannot change your own role. Ask another admin to do this.'
      }, 400);
    }

    const result = await updateMemberRole(membershipId, role, workosApiKey);

    if (!result.success) {
      return json({ error: result.error }, 500);
    }

    return json({ success: true, role });
  } catch (error) {
    console.error('Error updating member role:', error);
    return json({ error: 'Failed to update role' }, 500);
  }
}

/**
 * DELETE - Remove member from organization
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ orgId: string; membershipId: string }> }
) {
  const { orgId, membershipId } = await params;
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
    // Verify the membership belongs to this org
    const membership = await getMembership(membershipId, workosApiKey);
    if (!membership || membership.organization_id !== orgId) {
      return json({ error: 'Membership not found' }, 404);
    }

    // Prevent removing yourself
    if (membership.user_id === session.user.id) {
      return json({ error: 'Cannot remove yourself from the organization' }, 400);
    }

    const result = await removeMember(membershipId, workosApiKey);

    if (!result.success) {
      return json({ error: result.error }, 500);
    }

    return json({ success: true });
  } catch (error) {
    console.error('Error removing member:', error);
    return json({ error: 'Failed to remove member' }, 500);
  }
}
