/**
 * Clerk backend authentication helper
 * Verifies JWT tokens and extracts user/org information
 */

import { createClerkClient, verifyToken } from '@clerk/backend';

let clerk = null;

/**
 * Initialize Clerk client
 */
function getClerk() {
  if (!clerk) {
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) {
      throw new Error('CLERK_SECRET_KEY environment variable is not set');
    }
    clerk = createClerkClient({ secretKey });
  }
  return clerk;
}

/**
 * Verify JWT token from Authorization header
 * @param {Request} req - Request object
 * @returns {Promise<{userId: string, orgId: string|null}|null>} User info or null if invalid
 */
export async function verifyAuth(req) {
  try {
    const authHeader = req.headers.get ? req.headers.get('authorization') : req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const secretKey = process.env.CLERK_SECRET_KEY;

    if (!secretKey) {
      throw new Error('CLERK_SECRET_KEY environment variable is not set');
    }

    // Verify the token using standalone verifyToken function
    const sessionClaims = await verifyToken(token, { secretKey });

    if (!sessionClaims || !sessionClaims.sub) {
      return null;
    }

    return {
      userId: sessionClaims.sub,
      orgId: sessionClaims.org_id || null,
      email: sessionClaims.email || null,
    };
  } catch (error) {
    console.error('Clerk auth verification failed:', error);
    return null;
  }
}

/**
 * Check if request is authenticated
 * @param {Request} req - Request object
 * @returns {Promise<boolean>} True if authenticated
 */
export async function isAuthenticated(req) {
  const auth = await verifyAuth(req);
  return auth !== null;
}

/**
 * Require authentication, throw error if not authenticated
 * @param {Request} req - Request object
 * @returns {Promise<{userId: string, orgId: string|null}>} User info
 */
export async function requireAuth(req) {
  const auth = await verifyAuth(req);
  if (!auth) {
    throw new Error('Authentication required');
  }
  return auth;
}

/**
 * Verify user is member of organization
 * @param {string} userId - User ID
 * @param {string} orgId - Organization ID
 * @returns {Promise<boolean>} True if user is member
 */
export async function verifyOrgMembership(userId, orgId) {
  if (!orgId) {
    return false;
  }

  try {
    const clerk = getClerk();
    // Get user's organization memberships
    const response = await clerk.users.getOrganizationMembershipList({
      userId,
    });

    // Handle both old format (array) and new format ({ data: array })
    const memberships = response?.data || response || [];

    // Check if user is member of the specified org
    return memberships.some(m => m.organization?.id === orgId);
  } catch (error) {
    console.error('Failed to verify org membership:', error);
    return false;
  }
}

