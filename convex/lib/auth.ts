/**
 * Database-Backed Organization Membership Authentication
 *
 * This module provides authentication helpers that read org memberships from the
 * Convex database (userOrgMemberships table) rather than JWT claims.
 *
 * Benefits over JWT-based approach:
 * - Real-time updates: Membership changes take effect immediately (via webhooks)
 * - No stale data: JWT claims can be stale for up to 1 hour
 * - Consistent: Single source of truth in database
 *
 * Memberships are synced to the database via:
 * 1. WorkOS webhooks (real-time)
 * 2. Daily cron job (safety net)
 * 3. Manual sync action (debugging/support)
 */
import { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";

/**
 * Check if an email is in the SUPER_ADMIN_EMAILS environment variable
 * Exported for use in queries/actions that need super admin checks
 */
export function checkSuperAdmin(email: string): boolean {
  const superAdminEmails = process.env.SUPER_ADMIN_EMAILS || "";
  const emailList = superAdminEmails
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return emailList.includes(email.toLowerCase());
}

/**
 * Organization membership from database
 */
export interface OrgMembership {
  id: string;
  role: string;
}

/**
 * Auth context passed to Convex functions
 * Contains the authenticated user's WorkOS ID and organization memberships
 */
export interface AuthContext {
  workosUserId: string;
  email: string;
  isSuperAdmin: boolean;
  orgs: OrgMembership[];
}

/**
 * Get the authenticated user from the context
 * Extracts user info from JWT and org memberships from database
 * Returns null if not authenticated
 */
export async function getAuth(
  ctx: QueryCtx | MutationCtx | ActionCtx
): Promise<AuthContext | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  const email = (identity.email as string) || "";

  // Check super admin status against SUPER_ADMIN_EMAILS env var
  // (WorkOS access tokens don't include custom claims like isSuperAdmin)
  const isSuperAdmin = checkSuperAdmin(email);

  // Query org memberships from database for real-time accuracy
  let orgs: OrgMembership[] = [];

  if ("db" in ctx) {
    // QueryCtx or MutationCtx - can query database directly
    const dbCtx = ctx as QueryCtx | MutationCtx;
    const memberships = await dbCtx.db
      .query("userOrgMemberships")
      .withIndex("by_user", (q) => q.eq("workosUserId", identity.subject))
      .collect();

    orgs = memberships.map((m) => ({
      id: m.workosOrgId,
      role: m.role,
    }));
  } else {
    // ActionCtx - use runQuery to get memberships from database
    const actionCtx = ctx as ActionCtx;
    const memberships = await actionCtx.runQuery(
      internal.orgMemberships.getMembershipsInternal,
      { workosUserId: identity.subject }
    );
    orgs = memberships;
  }

  return {
    workosUserId: identity.subject,
    email,
    isSuperAdmin,
    orgs,
  };
}

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth(
  ctx: QueryCtx | MutationCtx | ActionCtx
): Promise<AuthContext> {
  const auth = await getAuth(ctx);
  if (!auth) {
    // Log to help debug token refresh issues
    // Note: identity is guaranteed null here since getAuth() only returns null when identity is null
    console.error("[Auth] Authentication failed - no valid identity token");
    throw new Error("Auth: Authentication required");
  }
  return auth;
}

/**
 * Require super admin role - throws if not super admin
 */
export async function requireSuperAdmin(
  ctx: QueryCtx | MutationCtx | ActionCtx
): Promise<AuthContext> {
  const auth = await requireAuth(ctx);
  if (!auth.isSuperAdmin) {
    throw new Error("Auth: Super admin access required");
  }
  return auth;
}

/**
 * Get user's role in an organization
 * Returns the role string or null if user is not a member
 */
export function getOrgRole(auth: AuthContext, workosOrgId: string): string | null {
  if (auth.isSuperAdmin) {
    return "admin"; // Super admins have admin access to all orgs
  }
  const membership = auth.orgs.find((org) => org.id === workosOrgId);
  return membership?.role || null;
}

/**
 * Check if user is an admin of an organization
 */
export function isOrgAdmin(auth: AuthContext, workosOrgId: string): boolean {
  if (auth.isSuperAdmin) {
    return true;
  }
  const role = getOrgRole(auth, workosOrgId);
  return role === "admin";
}

/**
 * Check if user has access to an organization
 * Now reads from database via AuthContext
 */
export function hasOrgAccess(
  auth: AuthContext,
  workosOrgId: string
): boolean {
  if (auth.isSuperAdmin) {
    return true;
  }
  return auth.orgs.some((org) => org.id === workosOrgId);
}

/**
 * Require access to an organization - throws if no access
 */
export function requireOrgAccess(
  auth: AuthContext,
  workosOrgId: string
): void {
  if (!hasOrgAccess(auth, workosOrgId)) {
    throw new Error("Auth: Organization access denied");
  }
}

/**
 * Require admin role in an organization - throws if not admin
 */
export function requireOrgAdmin(
  auth: AuthContext,
  workosOrgId: string
): void {
  if (!isOrgAdmin(auth, workosOrgId)) {
    throw new Error("Auth: Organization admin access required");
  }
}
