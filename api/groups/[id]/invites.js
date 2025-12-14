/**
 * Group invites API endpoint
 * Manages pending invitations for users not yet in the system
 */

import { requireAuth } from '../../lib/clerk.js';
import { query, queryOne, queryAll } from '../../lib/db.js';
import { getGroupRole, canManageMembers, canInviteToGroup } from '../../lib/permissions.js';
import { sendInviteEmail } from '../../lib/email-templates.js';
import { parseJsonBody } from '../../lib/request-utils.js';

export const config = {
  api: {
    bodyParser: true,
  },
};

const json = (res, status, payload) =>
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(payload));

/**
 * GET /api/groups/:id/invites - List pending invites
 * POST /api/groups/:id/invites - Create invite (sends email)
 * DELETE /api/groups/:id/invites - Cancel invite
 */
export default async function handler(req, res) {
  try {
    const auth = await requireAuth(req);
    const { userId, email } = auth;

    const groupId = req.query.id;
    if (!groupId) {
      json(res, 400, { error: 'Group ID is required' });
      return;
    }

    // Verify group exists
    const group = await queryOne(`SELECT * FROM groups WHERE id = $1`, [groupId]);
    if (!group) {
      json(res, 404, { error: 'Group not found' });
      return;
    }

    // Check user has access to group
    const userRole = await getGroupRole(userId, email, groupId);
    if (!userRole) {
      json(res, 403, { error: 'Access denied' });
      return;
    }

    if (req.method === 'GET') {
      // Only admins can view pending invites
      const canManage = await canManageMembers(userId, email, groupId);
      if (!canManage) {
        json(res, 403, { error: 'Only admins can view pending invites' });
        return;
      }

      const invites = await queryAll(
        `SELECT id, email, role, invited_by_user_id, created_at, expires_at
         FROM group_invites
         WHERE group_id = $1 AND expires_at > now()
         ORDER BY created_at DESC`,
        [groupId]
      );

      json(res, 200, { invites });
      return;
    }

    if (req.method === 'POST') {
      // Any member can invite
      const canInvite = await canInviteToGroup(userId, email, groupId);
      if (!canInvite) {
        json(res, 403, { error: 'Not authorized to invite' });
        return;
      }

      const { body, error: parseError } = parseJsonBody(req);
      if (parseError) {
        json(res, 400, { error: parseError });
        return;
      }

      const { email: inviteeEmail, role: requestedRole } = body;

      if (!inviteeEmail || typeof inviteeEmail !== 'string') {
        json(res, 400, { error: 'Email is required' });
        return;
      }

      const normalizedEmail = inviteeEmail.trim().toLowerCase();
      // Basic email validation: local@domain.tld format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        json(res, 400, { error: 'Invalid email format' });
        return;
      }

      // Viewers can only invite as viewer
      let role = requestedRole || 'viewer';
      if (!['admin', 'viewer'].includes(role)) {
        role = 'viewer';
      }
      if (userRole === 'viewer' && role !== 'viewer') {
        role = 'viewer';
      }

      // Check if user is already a member (look up by email in group_members)
      // We'd need Clerk lookup for this - for now, create invite
      // The accept endpoint will handle the case where user already exists

      // Check for existing pending invite
      const existingInvite = await queryOne(
        `SELECT * FROM group_invites WHERE group_id = $1 AND email = $2`,
        [groupId, normalizedEmail]
      );

      if (existingInvite) {
        // Update existing invite with new role and reset expiration
        await query(
          `UPDATE group_invites
           SET role = $1, invited_by_user_id = $2, expires_at = now() + interval '7 days'
           WHERE id = $3`,
          [role, userId, existingInvite.id]
        );
      } else {
        // Create new invite
        await query(
          `INSERT INTO group_invites (group_id, email, role, invited_by_user_id)
           VALUES ($1, $2, $3, $4)`,
          [groupId, normalizedEmail, role, userId]
        );
      }

      // Send invite email
      try {
        await sendInviteEmail(normalizedEmail, group.name, email);
      } catch (emailError) {
        console.error('Failed to send invite email:', emailError);
        // Continue anyway - invite is still created
      }

      json(res, 201, {
        success: true,
        email: normalizedEmail,
        role,
        message: 'Invite sent'
      });
      return;
    }

    if (req.method === 'DELETE') {
      // Only admins can cancel invites
      const canManage = await canManageMembers(userId, email, groupId);
      if (!canManage) {
        json(res, 403, { error: 'Only admins can cancel invites' });
        return;
      }

      const { body, error: parseError } = parseJsonBody(req);
      if (parseError) {
        json(res, 400, { error: parseError });
        return;
      }

      const { inviteId, email: inviteEmail } = body;

      if (!inviteId && !inviteEmail) {
        json(res, 400, { error: 'Invite ID or email is required' });
        return;
      }

      if (inviteId) {
        await query(
          `DELETE FROM group_invites WHERE id = $1 AND group_id = $2`,
          [inviteId, groupId]
        );
      } else {
        await query(
          `DELETE FROM group_invites WHERE email = $1 AND group_id = $2`,
          [inviteEmail.toLowerCase(), groupId]
        );
      }

      json(res, 200, { success: true });
      return;
    }

    json(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    if (error.message === 'Authentication required') {
      json(res, 401, { error: 'Authentication required' });
      return;
    }
    console.error('Group invites API error:', error);
    json(res, 500, { error: error.message || 'Internal server error' });
  }
}
