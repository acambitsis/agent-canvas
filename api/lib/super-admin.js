/**
 * Super admin helper utilities
 * Checks if a user is a super admin based on their email
 */

/**
 * Check if email belongs to a super admin
 * @param {string} email - User's email address
 * @returns {boolean}
 */
export function isSuperAdmin(email) {
  const superAdmins = (process.env.SUPER_ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  return superAdmins.includes(email?.toLowerCase());
}
