/**
 * Organization membership queries and mutations
 *
 * Provides real-time org membership data from Convex database,
 * synced from WorkOS via webhooks, cron, and manual sync.
 */

import { v } from "convex/values";
import { query, action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  syncUserMembershipsFromData,
  logSync,
} from "./lib/membershipSync";
import { requireSuperAdmin } from "./lib/auth";

/**
 * Get all organization memberships for the current user
 */
export const listMyMemberships = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const memberships = await ctx.db
      .query("userOrgMemberships")
      .withIndex("by_user", (q) => q.eq("workosUserId", identity.subject))
      .collect();

    return memberships.map((m) => ({
      orgId: m.workosOrgId,
      role: m.role,
    }));
  },
});

/**
 * Get memberships for a specific user (admin only)
 */
export const listUserMemberships = query({
  args: { workosUserId: v.string() },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);

    const memberships = await ctx.db
      .query("userOrgMemberships")
      .withIndex("by_user", (q) => q.eq("workosUserId", args.workosUserId))
      .collect();

    return memberships.map((m) => ({
      orgId: m.workosOrgId,
      role: m.role,
    }));
  },
});

/**
 * Check if user has access to a specific org
 */
export const hasOrgAccess = query({
  args: { workosOrgId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return false;
    }

    // Check for super admin (from JWT claims)
    const isSuperAdmin = identity.isSuperAdmin as boolean | undefined;
    if (isSuperAdmin) {
      return true;
    }

    const membership = await ctx.db
      .query("userOrgMemberships")
      .withIndex("by_user_org", (q) =>
        q.eq("workosUserId", identity.subject).eq("workosOrgId", args.workosOrgId)
      )
      .first();

    return membership !== null;
  },
});

/**
 * Get user's role in a specific org
 */
export const getOrgRole = query({
  args: { workosOrgId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    // Super admins have admin access
    const isSuperAdmin = identity.isSuperAdmin as boolean | undefined;
    if (isSuperAdmin) {
      return "admin";
    }

    const membership = await ctx.db
      .query("userOrgMemberships")
      .withIndex("by_user_org", (q) =>
        q.eq("workosUserId", identity.subject).eq("workosOrgId", args.workosOrgId)
      )
      .first();

    return membership?.role || null;
  },
});

// ============================================================================
// Internal mutations for sync operations
// ============================================================================

/**
 * Internal mutation to sync memberships from fetched data
 * Called by actions that fetch from WorkOS API
 */
export const syncFromFetchedData = internalMutation({
  args: {
    workosUserId: v.string(),
    memberships: v.array(v.object({
      orgId: v.string(),
      role: v.string(),
    })),
    syncType: v.union(v.literal("webhook"), v.literal("cron"), v.literal("manual")),
  },
  handler: async (ctx, args) => {
    const timestamp = Date.now();

    const result = await syncUserMembershipsFromData(
      ctx,
      args.workosUserId,
      args.memberships,
      timestamp
    );

    // Log the sync operation
    await logSync(
      ctx,
      args.syncType,
      result.errors.length > 0 ? "partial" : "success",
      args.workosUserId,
      `added=${result.added}, updated=${result.updated}, removed=${result.removed}${
        result.errors.length > 0 ? `, errors=${result.errors.length}` : ""
      }`
    );

    return result;
  },
});

/**
 * Internal mutation to upsert a single membership (for webhooks)
 */
export const upsertMembershipInternal = internalMutation({
  args: {
    workosUserId: v.string(),
    workosOrgId: v.string(),
    role: v.string(),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const { upsertMembership } = await import("./lib/membershipSync");

    const action = await upsertMembership(
      ctx,
      args.workosUserId,
      args.workosOrgId,
      args.role,
      args.timestamp
    );

    await logSync(
      ctx,
      "webhook",
      "success",
      args.workosUserId,
      `upsert ${args.workosOrgId}: ${action}`
    );

    return action;
  },
});

/**
 * Internal mutation to remove a single membership (for webhooks)
 */
export const removeMembershipInternal = internalMutation({
  args: {
    workosUserId: v.string(),
    workosOrgId: v.string(),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const { removeMembership, logSync } = await import("./lib/membershipSync");

    const removed = await removeMembership(
      ctx,
      args.workosUserId,
      args.workosOrgId,
      args.timestamp
    );

    await logSync(
      ctx,
      "webhook",
      "success",
      args.workosUserId,
      `remove ${args.workosOrgId}: ${removed ? "removed" : "skipped"}`
    );

    return removed;
  },
});

// ============================================================================
// Manual sync actions (user-initiated)
// ============================================================================

/**
 * Result type for sync operations
 */
interface SyncResultType {
  added: number;
  updated: number;
  removed: number;
  errors: string[];
}

/**
 * Sync current user's memberships from WorkOS
 * This is the manual sync button action
 */
export const syncMyMemberships = action({
  args: {},
  handler: async (ctx): Promise<SyncResultType> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    const workosUserId = identity.subject;

    // Fetch current memberships from WorkOS API
    const apiKey = process.env.WORKOS_API_KEY;
    if (!apiKey) {
      throw new Error("WorkOS API key not configured");
    }

    const response = await fetch(
      `https://api.workos.com/user_management/organization_memberships?user_id=${workosUserId}&limit=100`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch memberships from WorkOS: ${errorText}`);
    }

    const data = await response.json();
    const memberships = (data.data || []).map(
      (m: { organization_id: string; role?: { slug: string } }) => ({
        orgId: m.organization_id,
        role: m.role?.slug || "member",
      })
    );

    // Sync to Convex
    const result: SyncResultType = await ctx.runMutation(internal.orgMemberships.syncFromFetchedData, {
      workosUserId,
      memberships,
      syncType: "manual",
    });

    return result;
  },
});

/**
 * Sync all memberships for all users (admin only)
 * Used for initial setup or fixing drift
 */
export const syncAllMemberships = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    // Check super admin from JWT claims
    const isSuperAdmin = identity.isSuperAdmin as boolean | undefined;
    if (!isSuperAdmin) {
      throw new Error("Super admin access required");
    }

    const apiKey = process.env.WORKOS_API_KEY;
    if (!apiKey) {
      throw new Error("WorkOS API key not configured");
    }

    // Fetch all organization memberships from WorkOS
    // Note: This may need pagination for large deployments
    let allMemberships: Array<{
      user_id: string;
      organization_id: string;
      role?: { slug: string };
    }> = [];
    let after: string | undefined;

    do {
      const url = new URL(
        "https://api.workos.com/user_management/organization_memberships"
      );
      url.searchParams.set("limit", "100");
      if (after) url.searchParams.set("after", after);

      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch memberships: ${response.status}`);
      }

      const data = await response.json();
      allMemberships = allMemberships.concat(data.data || []);

      // Check for pagination
      after = data.list_metadata?.after;
    } while (after);

    // Group by user
    const membershipsByUser = new Map<
      string,
      Array<{ orgId: string; role: string }>
    >();
    for (const m of allMemberships) {
      const userId = m.user_id;
      if (!membershipsByUser.has(userId)) {
        membershipsByUser.set(userId, []);
      }
      membershipsByUser.get(userId)!.push({
        orgId: m.organization_id,
        role: m.role?.slug || "member",
      });
    }

    // Sync each user
    let totalAdded = 0;
    let totalUpdated = 0;
    let totalRemoved = 0;
    const errors: string[] = [];

    for (const [userId, memberships] of membershipsByUser) {
      try {
        const result = await ctx.runMutation(
          internal.orgMemberships.syncFromFetchedData,
          {
            workosUserId: userId,
            memberships,
            syncType: "cron",
          }
        );
        totalAdded += result.added;
        totalUpdated += result.updated;
        totalRemoved += result.removed;
        errors.push(...result.errors);
      } catch (error) {
        errors.push(`Failed to sync user ${userId}: ${error}`);
      }
    }

    return {
      usersProcessed: membershipsByUser.size,
      added: totalAdded,
      updated: totalUpdated,
      removed: totalRemoved,
      errors,
    };
  },
});

/**
 * Get recent sync logs (admin only)
 */
export const getSyncLogs = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);

    const logs = await ctx.db
      .query("syncLog")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit || 50);

    return logs;
  },
});
