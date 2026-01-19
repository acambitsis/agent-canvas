/**
 * POST /api/org/[orgId]/invite
 * Invite a user to an organization (admin only)
 */

import { parseSession, json } from '@/server/session-utils';
import { inviteToOrg } from '@/server/workos';

export const runtime = 'edge';

/**
 * Check if caller is admin of the specified org
 */
function isOrgAdmin(
  session: { orgs: Array<{ id: string; role: string }> },
  orgId: string
): boolean {
  const membership = session.orgs.find((org) => org.id === orgId);
  return membership?.role === 'admin';
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const session = await parseSession(request);

  if (!session) {
    return json({ error: 'Unauthorized' }, 401);
  }

  // Check if caller is admin of this org
  if (!isOrgAdmin(session, orgId)) {
    return json({ error: 'Admin access required' }, 403);
  }

  const workosApiKey = process.env.WORKOS_API_KEY;
  if (!workosApiKey) {
    return json({ error: 'WorkOS not configured' }, 500);
  }

  try {
    const body = await request.json();
    const { email, role } = body as { email?: string; role?: string };

    if (!email || typeof email !== 'string') {
      return json({ error: 'Email is required' }, 400);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return json({ error: 'Invalid email format' }, 400);
    }

    // Default role to 'member' if not specified
    const memberRole = role || 'member';
    if (memberRole !== 'admin' && memberRole !== 'member') {
      return json({ error: 'Invalid role. Must be "admin" or "member"' }, 400);
    }

    const result = await inviteToOrg(orgId, email, memberRole, workosApiKey);

    if (!result) {
      return json({ error: 'Failed to send invitation' }, 500);
    }

    return json({
      success: true,
      invitationId: result.id,
      message: `Invitation sent to ${email}`
    });
  } catch (error) {
    console.error('Error sending invitation:', error);
    return json({ error: 'Failed to send invitation' }, 500);
  }
}
