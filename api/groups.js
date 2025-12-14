/**
 * Groups API endpoint
 * Manages groups for sharing canvases (no org dependency)
 */

import { requireAuth } from './lib/clerk.js';
import { query, queryOne, queryAll } from './lib/db.js';
import { getUserGroups, canCreateGroup, canDeleteGroup } from './lib/permissions.js';
import { isSuperAdmin } from './lib/super-admin.js';
import { parseJsonBody } from './lib/request-utils.js';

export const config = {
  api: {
    bodyParser: true,
  },
};

const json = (res, status, payload) =>
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(payload));

/**
 * GET /api/groups - List groups user belongs to
 * POST /api/groups - Create a new group (super admin only)
 */
export default async function handler(req, res) {
  try {
    const auth = await requireAuth(req);
    const { userId, email } = auth;

    if (req.method === 'GET') {
      const groups = await getUserGroups(userId, email);

      // Add member count for each group
      const groupsWithCounts = await Promise.all(
        groups.map(async (group) => {
          const countResult = await queryOne(
            `SELECT COUNT(*) as count FROM group_members WHERE group_id = $1`,
            [group.id]
          );
          return {
            ...group,
            member_count: parseInt(countResult?.count || '0', 10),
          };
        })
      );

      json(res, 200, {
        groups: groupsWithCounts,
        is_super_admin: isSuperAdmin(email)
      });
      return;
    }

    if (req.method === 'POST') {
      // Only super admins can create groups
      if (!canCreateGroup(email)) {
        json(res, 403, { error: 'Only super admins can create groups' });
        return;
      }

      const { body, error: parseError } = parseJsonBody(req);
      if (parseError) {
        json(res, 400, { error: parseError });
        return;
      }

      const { name } = body;

      if (!name || typeof name !== 'string' || !name.trim()) {
        json(res, 400, { error: 'Group name is required' });
        return;
      }

      const groupName = name.trim();

      // Check if group already exists (globally unique)
      const existing = await queryOne(
        `SELECT * FROM groups WHERE name = $1`,
        [groupName]
      );

      if (existing) {
        json(res, 400, { error: 'A group with this name already exists' });
        return;
      }

      const result = await queryOne(
        `INSERT INTO groups (name, created_by_user_id)
         VALUES ($1, $2)
         RETURNING id, name, created_at, created_by_user_id`,
        [groupName, userId]
      );

      // Automatically add creator as admin
      await query(
        `INSERT INTO group_members (group_id, user_id, role, invited_by_user_id)
         VALUES ($1, $2, 'admin', NULL)`,
        [result.id, userId]
      );

      json(res, 201, {
        group: {
          ...result,
          role: 'admin',
          member_count: 1
        }
      });
      return;
    }

    if (req.method === 'DELETE') {
      // Only super admins can delete groups
      if (!canDeleteGroup(email)) {
        json(res, 403, { error: 'Only super admins can delete groups' });
        return;
      }

      const { body, error: parseError } = parseJsonBody(req);
      if (parseError) {
        json(res, 400, { error: parseError });
        return;
      }

      const { groupId } = body;
      if (!groupId) {
        json(res, 400, { error: 'Group ID is required' });
        return;
      }

      // Check group exists
      const group = await queryOne(`SELECT * FROM groups WHERE id = $1`, [groupId]);
      if (!group) {
        json(res, 404, { error: 'Group not found' });
        return;
      }

      // Delete group (cascades to members, invites, and canvases)
      await query(`DELETE FROM groups WHERE id = $1`, [groupId]);

      json(res, 200, { success: true, deleted: group.name });
      return;
    }

    json(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    if (error.message === 'Authentication required') {
      json(res, 401, { error: 'Authentication required' });
      return;
    }
    console.error('Groups API error:', error);
    json(res, 500, { error: error.message || 'Internal server error' });
  }
}
