/**
 * User-related Convex functions
 *
 * Note: Organization membership syncing has been removed.
 * Org memberships are now stored in JWT claims and verified directly
 * from the token identity, eliminating the need for database syncing.
 *
 * The userOrgMemberships table has been removed from the schema.
 * See convex/lib/auth.ts for the new JWT-based org access implementation.
 */

// This file is intentionally minimal - org membership functions have been removed
// as they're no longer needed with JWT-based org claims
