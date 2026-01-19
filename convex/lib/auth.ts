import { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";

/**
 * Organization membership from JWT claims
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
 * Extracts user info and org memberships from JWT claims
 * Returns null if not authenticated
 */
export async function getAuth(
  ctx: QueryCtx | MutationCtx | ActionCtx
): Promise<AuthContext | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  // Extract orgs from JWT claims (defaults to empty array if not present)
  const orgsFromToken = identity.orgs as Array<{ id: string; role: string }> | undefined;
  const orgs: OrgMembership[] = orgsFromToken || [];

  return {
    workosUserId: identity.subject,
    email: (identity.email as string) || "",
    isSuperAdmin: (identity.isSuperAdmin as boolean) || false,
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
 * Reads from JWT claims - no database lookup needed
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
