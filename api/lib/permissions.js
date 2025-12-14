/**
 * Permission checking utilities for group-based access control
 */

import { query, queryOne, queryAll } from './db.js';
import { isSuperAdmin } from './super-admin.js';

/**
 * Get user's role in a group
 * @param {string} userId - User ID
 * @param {string} email - User's email
 * @param {string} groupId - Group ID
 * @returns {Promise<'super_admin' | 'admin' | 'viewer' | null>}
 */
export async function getGroupRole(userId, email, groupId) {
  if (isSuperAdmin(email)) return 'super_admin';

  const membership = await queryOne(
    `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
    [groupId, userId]
  );

  return membership?.role || null;
}

/**
 * Check if user can view canvases in a group
 * @param {string} userId - User ID
 * @param {string} email - User's email
 * @param {string} groupId - Group ID
 * @returns {Promise<boolean>}
 */
export async function canViewGroup(userId, email, groupId) {
  const role = await getGroupRole(userId, email, groupId);
  return role !== null; // Any role can view
}

/**
 * Check if user can create/delete/rename canvases in a group
 * @param {string} userId - User ID
 * @param {string} email - User's email
 * @param {string} groupId - Group ID
 * @returns {Promise<boolean>}
 */
export async function canManageCanvases(userId, email, groupId) {
  const role = await getGroupRole(userId, email, groupId);
  return role === 'super_admin' || role === 'admin';
}

/**
 * Check if user can manage group members (add/remove/change roles)
 * @param {string} userId - User ID
 * @param {string} email - User's email
 * @param {string} groupId - Group ID
 * @returns {Promise<boolean>}
 */
export async function canManageMembers(userId, email, groupId) {
  const role = await getGroupRole(userId, email, groupId);
  return role === 'super_admin' || role === 'admin';
}

/**
 * Check if user can invite others to a group
 * Admins can invite with any role, viewers can only invite as viewers
 * @param {string} userId - User ID
 * @param {string} email - User's email
 * @param {string} groupId - Group ID
 * @returns {Promise<boolean>}
 */
export async function canInviteToGroup(userId, email, groupId) {
  const role = await getGroupRole(userId, email, groupId);
  return role !== null; // Any member can invite
}

/**
 * Check if user can create new groups (super admin only)
 * @param {string} email - User's email
 * @returns {boolean}
 */
export function canCreateGroup(email) {
  return isSuperAdmin(email);
}

/**
 * Check if user can delete groups (super admin only)
 * @param {string} email - User's email
 * @returns {boolean}
 */
export function canDeleteGroup(email) {
  return isSuperAdmin(email);
}

/**
 * Get all groups user has access to
 * @param {string} userId - User ID
 * @param {string} email - User's email
 * @returns {Promise<Array>}
 */
export async function getUserGroups(userId, email) {
  // Super admins see all groups
  if (isSuperAdmin(email)) {
    return await queryAll(
      `SELECT g.*, 'super_admin' as role
       FROM groups g
       ORDER BY g.name`
    );
  }

  return await queryAll(
    `SELECT g.*, gm.role
     FROM groups g
     INNER JOIN group_members gm ON g.id = gm.group_id
     WHERE gm.user_id = $1
     ORDER BY g.name`,
    [userId]
  );
}

/**
 * Check if user has access to a canvas
 * @param {string} userId - User ID
 * @param {string} email - User's email
 * @param {string} canvasId - Canvas ID or slug
 * @returns {Promise<{hasAccess: boolean, canvas: object|null, role: string|null}>}
 */
export async function checkCanvasAccess(userId, email, canvasId) {
  // Find the canvas by ID or slug
  const canvas = await queryOne(
    `SELECT c.*, g.name as group_name
     FROM canvases c
     INNER JOIN groups g ON c.group_id = g.id
     WHERE c.id::text = $1 OR c.slug = $1`,
    [canvasId]
  );

  if (!canvas) {
    return { hasAccess: false, canvas: null, role: null };
  }

  // Check user's role in the canvas's group
  const role = await getGroupRole(userId, email, canvas.group_id);

  if (role === null) {
    return { hasAccess: false, canvas, role: null };
  }

  return { hasAccess: true, canvas, role };
}

/**
 * Check if user can write to canvas (viewers are read-only)
 * @param {string} userId - User ID
 * @param {string} email - User's email
 * @param {string} canvasId - Canvas ID or slug
 * @returns {Promise<{hasAccess: boolean, canvas: object|null, role: string|null}>}
 */
export async function checkCanvasWriteAccess(userId, email, canvasId) {
  const { hasAccess, canvas, role } = await checkCanvasAccess(userId, email, canvasId);

  if (!hasAccess) {
    return { hasAccess: false, canvas, role };
  }

  // Viewers are read-only
  if (role === 'viewer') {
    return { hasAccess: false, canvas, role };
  }

  return { hasAccess: true, canvas, role };
}

/**
 * Get all canvases user can access
 * @param {string} userId - User ID
 * @param {string} email - User's email
 * @returns {Promise<Array>}
 */
export async function getAccessibleCanvases(userId, email) {
  const groups = await getUserGroups(userId, email);
  const groupIds = groups.map(g => g.id);

  if (groupIds.length === 0) return [];

  return await queryAll(
    `SELECT c.*, g.name as group_name
     FROM canvases c
     INNER JOIN groups g ON c.group_id = g.id
     WHERE c.group_id = ANY($1)
     ORDER BY g.name, c.title`,
    [groupIds]
  );
}

/**
 * Get canvases in a specific group
 * @param {string} userId - User ID
 * @param {string} email - User's email
 * @param {string} groupId - Group ID
 * @returns {Promise<Array>}
 */
export async function getGroupCanvases(userId, email, groupId) {
  const role = await getGroupRole(userId, email, groupId);

  if (role === null) {
    return [];
  }

  return await queryAll(
    `SELECT c.*, g.name as group_name
     FROM canvases c
     INNER JOIN groups g ON c.group_id = g.id
     WHERE c.group_id = $1
     ORDER BY c.title`,
    [groupId]
  );
}
