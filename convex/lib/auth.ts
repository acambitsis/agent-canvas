import { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";

/**
 * Auth context passed to Convex functions
 * Contains the authenticated user's WorkOS ID
 */
export interface AuthContext {
  workosUserId: string;
  email: string;
  isSuperAdmin: boolean;
}

/**
 * Get the authenticated user from the context
 * Returns null if not authenticated
 */
export async function getAuth(
  ctx: QueryCtx | MutationCtx | ActionCtx
): Promise<AuthContext | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  return {
    workosUserId: identity.subject,
    email: (identity.email as string) || "",
    isSuperAdmin: (identity.isSuperAdmin as boolean) || false,
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
  ctx: QueryCtx | MutationCtx
): Promise<AuthContext> {
  const auth = await requireAuth(ctx);
  if (!auth.isSuperAdmin) {
    throw new Error("Auth: Super admin access required");
  }
  return auth;
}

/**
 * Check if user has access to an organization
 * Looks up membership in the userOrgMemberships table
 *
 * NOTE: This function requires database access, so it cannot be used in actions.
 * Actions should call a mutation/query that performs the access check, or use
 * the syncOrgMemberships action which verifies access via WorkOS API directly.
 */
export async function hasOrgAccess(
  ctx: QueryCtx | MutationCtx,
  auth: AuthContext,
  workosOrgId: string
): Promise<boolean> {
  if (auth.isSuperAdmin) {
    return true;
  }

  const membership = await ctx.db
    .query("userOrgMemberships")
    .withIndex("by_user_org", (q) =>
      q.eq("workosUserId", auth.workosUserId).eq("workosOrgId", workosOrgId)
    )
    .first();

  return !!membership;
}

/**
 * Require access to an organization - throws if no access
 */
export async function requireOrgAccess(
  ctx: QueryCtx | MutationCtx,
  auth: AuthContext,
  workosOrgId: string
): Promise<void> {
  if (!(await hasOrgAccess(ctx, auth, workosOrgId))) {
    throw new Error("Auth: Organization access denied");
  }
}
