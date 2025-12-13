/**
 * Permission checking utilities for canvas access
 */

import { query, queryOne } from './db.js';
import { verifyOrgMembership } from './clerk.js';

/**
 * Check if user has access to a canvas
 * @param {string} userId - User ID
 * @param {string|null} orgId - Organization ID (if in org context)
 * @param {string} canvasId - Canvas ID or slug
 * @returns {Promise<{hasAccess: boolean, canvas: object|null}>}
 */
export async function checkCanvasAccess(userId, orgId, canvasId) {
  // First, find the canvas by ID or slug
  // Cast id to text to allow comparison with slug (text) using same parameter
  const canvas = await queryOne(
    `SELECT * FROM canvases WHERE id::text = $1 OR slug = $1`,
    [canvasId]
  );

  if (!canvas) {
    return { hasAccess: false, canvas: null };
  }

  // Check if user is the owner
  if (canvas.owner_user_id === userId) {
    return { hasAccess: true, canvas };
  }

  // For org canvases, verify user is in the org
  if (canvas.scope_type === 'org') {
    if (!orgId || canvas.org_id !== orgId) {
      return { hasAccess: false, canvas };
    }
    
    // Verify user is actually a member of the org (via Clerk)
    const isMember = await verifyOrgMembership(userId, orgId);
    if (!isMember) {
      return { hasAccess: false, canvas };
    }
  }

  // Check direct user share
  const userShare = await queryOne(
    `SELECT * FROM canvas_acl 
     WHERE canvas_id = $1 AND principal_type = 'user' AND principal_id = $2`,
    [canvas.id, userId]
  );

  if (userShare) {
    return { hasAccess: true, canvas };
  }

  // Check group shares
  if (orgId) {
    const groupShares = await query(
      `SELECT ca.* FROM canvas_acl ca
       INNER JOIN group_members gm ON ca.principal_id = gm.group_id::text
       WHERE ca.canvas_id = $1 
         AND ca.principal_type = 'group'
         AND gm.user_id = $2`,
      [canvas.id, userId]
    );

    if (groupShares && groupShares.length > 0) {
      return { hasAccess: true, canvas };
    }
  }

  return { hasAccess: false, canvas };
}

/**
 * Get all canvases accessible to a user
 * @param {string} userId - User ID
 * @param {string|null} orgId - Organization ID (if in org context)
 * @returns {Promise<Array>} List of accessible canvases
 */
export async function getAccessibleCanvases(userId, orgId) {
  // Personal canvases owned by user
  const personalCanvases = await query(
    `SELECT id, scope_type, owner_user_id, org_id, title, slug, 
            created_at, updated_at, created_by_user_id, updated_by_user_id
     FROM canvases
     WHERE scope_type = 'personal' AND owner_user_id = $1`,
    [userId]
  );

  // Org canvases where user is member
  let orgCanvases = [];
  if (orgId) {
    orgCanvases = await query(
      `SELECT c.id, c.scope_type, c.owner_user_id, c.org_id, c.title, c.slug,
              c.created_at, c.updated_at, c.created_by_user_id, c.updated_by_user_id
       FROM canvases c
       WHERE c.scope_type = 'org' AND c.org_id = $1`,
      [orgId]
    );
  }

  // Shared canvases (direct user shares)
  const sharedCanvases = await query(
    `SELECT c.id, c.scope_type, c.owner_user_id, c.org_id, c.title, c.slug,
            c.created_at, c.updated_at, c.created_by_user_id, c.updated_by_user_id
     FROM canvases c
     INNER JOIN canvas_acl ca ON c.id = ca.canvas_id
     WHERE ca.principal_type = 'user' AND ca.principal_id = $1
       AND c.owner_user_id != $1`,
    [userId]
  );

  // Group-shared canvases (if in org context)
  let groupSharedCanvases = [];
  if (orgId) {
    groupSharedCanvases = await query(
      `SELECT DISTINCT c.id, c.scope_type, c.owner_user_id, c.org_id, c.title, c.slug,
              c.created_at, c.updated_at, c.created_by_user_id, c.updated_by_user_id
       FROM canvases c
       INNER JOIN canvas_acl ca ON c.id = ca.canvas_id
       INNER JOIN group_members gm ON ca.principal_id = gm.group_id::text
       WHERE ca.principal_type = 'group'
         AND gm.user_id = $1
         AND c.owner_user_id != $1`,
      [userId]
    );
  }

  // Combine and deduplicate
  const allCanvases = [
    ...personalCanvases,
    ...orgCanvases,
    ...sharedCanvases,
    ...groupSharedCanvases,
  ];

  // Deduplicate by ID
  const uniqueCanvases = new Map();
  for (const canvas of allCanvases) {
    if (!uniqueCanvases.has(canvas.id)) {
      uniqueCanvases.set(canvas.id, canvas);
    }
  }

  return Array.from(uniqueCanvases.values());
}

/**
 * Check if user can write to canvas
 * For MVP, same as read access (RW-only)
 */
export async function checkCanvasWriteAccess(userId, orgId, canvasId) {
  return await checkCanvasAccess(userId, orgId, canvasId);
}

