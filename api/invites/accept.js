/**
 * Accept invites API endpoint
 * Called after successful authentication to process pending invites
 */

import { requireAuth } from '../lib/clerk.js';
import { query, queryOne, queryAll } from '../lib/db.js';

export const config = {
  api: {
    bodyParser: true,
  },
};

const json = (res, status, payload) =>
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(payload));

/**
 * POST /api/invites/accept - Process pending invites for authenticated user
 */
export default async function handler(req, res) {
  try {
    const auth = await requireAuth(req);
    const { userId, email } = auth;

    if (req.method !== 'POST') {
      json(res, 405, { error: 'Method not allowed' });
      return;
    }

    if (!email) {
      json(res, 400, { error: 'Email not available from authentication' });
      return;
    }

    const normalizedEmail = email.toLowerCase();

    // Find pending invites for this email that haven't expired
    const invites = await queryAll(
      `SELECT gi.*, g.name as group_name
       FROM group_invites gi
       INNER JOIN groups g ON gi.group_id = g.id
       WHERE gi.email = $1 AND gi.expires_at > now()`,
      [normalizedEmail]
    );

    const processed = [];
    const alreadyMember = [];

    for (const invite of invites) {
      // Check if already a member
      const existingMembership = await queryOne(
        `SELECT * FROM group_members WHERE group_id = $1 AND user_id = $2`,
        [invite.group_id, userId]
      );

      if (existingMembership) {
        alreadyMember.push({
          group_id: invite.group_id,
          group_name: invite.group_name
        });
      } else {
        // Add to group
        await query(
          `INSERT INTO group_members (group_id, user_id, role, invited_by_user_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (group_id, user_id) DO NOTHING`,
          [invite.group_id, userId, invite.role, invite.invited_by_user_id]
        );

        processed.push({
          group_id: invite.group_id,
          group_name: invite.group_name,
          role: invite.role
        });
      }
    }

    // Delete processed invites for this email
    if (invites.length > 0) {
      await query(
        `DELETE FROM group_invites WHERE email = $1`,
        [normalizedEmail]
      );
    }

    json(res, 200, {
      processed: processed.length,
      groups: processed,
      already_member: alreadyMember
    });
  } catch (error) {
    if (error.message === 'Authentication required') {
      json(res, 401, { error: 'Authentication required' });
      return;
    }
    console.error('Accept invites API error:', error);
    json(res, 500, { error: error.message || 'Internal server error' });
  }
}
