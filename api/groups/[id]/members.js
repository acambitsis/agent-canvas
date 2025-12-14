/**
 * Group members API endpoint
 * Manages members of a group with role-based access
 */

import { requireAuth } from '../../lib/clerk.js';
import { query, queryOne, queryAll } from '../../lib/db.js';
import { getGroupRole, canManageMembers, canInviteToGroup } from '../../lib/permissions.js';
import { parseJsonBody } from '../../lib/request-utils.js';

export const config = {
  api: {
    bodyParser: true,
  },
};

const json = (res, status, payload) =>
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(payload));

/**
 * GET /api/groups/:id/members - List group members
 * POST /api/groups/:id/members - Add a member to group
 * PUT /api/groups/:id/members - Update member role
 * DELETE /api/groups/:id/members - Remove a member from group
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
      const members = await queryAll(
        `SELECT gm.user_id, gm.role, gm.invited_by_user_id, gm.created_at
         FROM group_members gm
         WHERE gm.group_id = $1
         ORDER BY gm.created_at ASC`,
        [groupId]
      );

      json(res, 200, {
        members,
        user_role: userRole
      });
      return;
    }

    if (req.method === 'POST') {
      // Any member can invite, but viewers can only invite as viewer
      const canInvite = await canInviteToGroup(userId, email, groupId);
      if (!canInvite) {
        json(res, 403, { error: 'Not authorized to add members' });
        return;
      }

      const { body, error: parseError } = parseJsonBody(req);
      if (parseError) {
        json(res, 400, { error: parseError });
        return;
      }

      const { userId: targetUserId, role: requestedRole } = body;

      if (!targetUserId || typeof targetUserId !== 'string') {
        json(res, 400, { error: 'User ID is required' });
        return;
      }

      // Validate role
      let role = requestedRole || 'viewer';
      if (!['admin', 'viewer'].includes(role)) {
        json(res, 400, { error: 'Invalid role. Must be admin or viewer' });
        return;
      }

      // Viewers can only add as viewer
      if (userRole === 'viewer' && role !== 'viewer') {
        role = 'viewer';
      }

      // Check if already a member
      const existing = await queryOne(
        `SELECT * FROM group_members WHERE group_id = $1 AND user_id = $2`,
        [groupId, targetUserId]
      );

      if (existing) {
        json(res, 400, { error: 'User is already a member of this group' });
        return;
      }

      await query(
        `INSERT INTO group_members (group_id, user_id, role, invited_by_user_id)
         VALUES ($1, $2, $3, $4)`,
        [groupId, targetUserId, role, userId]
      );

      json(res, 201, { success: true, userId: targetUserId, role });
      return;
    }

    if (req.method === 'PUT') {
      // Only admins can change roles
      const canManage = await canManageMembers(userId, email, groupId);
      if (!canManage) {
        json(res, 403, { error: 'Only admins can change member roles' });
        return;
      }

      const { body, error: parseError } = parseJsonBody(req);
      if (parseError) {
        json(res, 400, { error: parseError });
        return;
      }

      const { userId: targetUserId, role } = body;

      if (!targetUserId || typeof targetUserId !== 'string') {
        json(res, 400, { error: 'User ID is required' });
        return;
      }

      if (!role || !['admin', 'viewer'].includes(role)) {
        json(res, 400, { error: 'Invalid role. Must be admin or viewer' });
        return;
      }

      // Check if member exists
      const member = await queryOne(
        `SELECT * FROM group_members WHERE group_id = $1 AND user_id = $2`,
        [groupId, targetUserId]
      );

      if (!member) {
        json(res, 404, { error: 'User is not a member of this group' });
        return;
      }

      // If demoting from admin, ensure there's at least one other admin
      if (member.role === 'admin' && role === 'viewer') {
        const adminCount = await queryOne(
          `SELECT COUNT(*) as count FROM group_members WHERE group_id = $1 AND role = 'admin'`,
          [groupId]
        );

        if (parseInt(adminCount.count, 10) <= 1) {
          json(res, 400, { error: 'Cannot demote the last admin. Promote another member first.' });
          return;
        }
      }

      await query(
        `UPDATE group_members SET role = $1 WHERE group_id = $2 AND user_id = $3`,
        [role, groupId, targetUserId]
      );

      json(res, 200, { success: true, userId: targetUserId, role });
      return;
    }

    if (req.method === 'DELETE') {
      // Only admins can remove members
      const canManage = await canManageMembers(userId, email, groupId);
      if (!canManage) {
        json(res, 403, { error: 'Only admins can remove members' });
        return;
      }

      const { body, error: parseError } = parseJsonBody(req);
      if (parseError) {
        json(res, 400, { error: parseError });
        return;
      }

      const { userId: targetUserId } = body;

      if (!targetUserId || typeof targetUserId !== 'string') {
        json(res, 400, { error: 'User ID is required' });
        return;
      }

      // Check if member exists
      const member = await queryOne(
        `SELECT * FROM group_members WHERE group_id = $1 AND user_id = $2`,
        [groupId, targetUserId]
      );

      if (!member) {
        json(res, 404, { error: 'User is not a member of this group' });
        return;
      }

      // If removing an admin, ensure there's at least one other admin
      if (member.role === 'admin') {
        const adminCount = await queryOne(
          `SELECT COUNT(*) as count FROM group_members WHERE group_id = $1 AND role = 'admin'`,
          [groupId]
        );

        if (parseInt(adminCount.count, 10) <= 1) {
          json(res, 400, { error: 'Cannot remove the last admin. Promote another member first.' });
          return;
        }
      }

      await query(
        `DELETE FROM group_members WHERE group_id = $1 AND user_id = $2`,
        [groupId, targetUserId]
      );

      json(res, 200, { success: true, userId: targetUserId });
      return;
    }

    json(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    if (error.message === 'Authentication required') {
      json(res, 401, { error: 'Authentication required' });
      return;
    }
    console.error('Group members API error:', error);
    json(res, 500, { error: error.message || 'Internal server error' });
  }
}
