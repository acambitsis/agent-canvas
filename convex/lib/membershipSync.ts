/**
 * Shared membership sync logic
 *
 * This module provides reusable functions for syncing organization memberships
 * from WorkOS to Convex. Used by:
 * - Webhooks (real-time sync)
 * - Daily cron job (safety net)
 * - Manual sync (debugging/support)
 */

import { MutationCtx, ActionCtx } from "../_generated/server";
import { SyncType } from "./validators";

/**
 * Result of a sync operation
 */
export interface SyncResult {
  added: number;
  updated: number;
  removed: number;
  errors: string[];
}

/**
 * WorkOS organization membership from API
 */
export interface WorkOSMembership {
  id: string;
  organization_id: string;
  user_id: string;
  role?: {
    slug: string;
  };
  status?: string;
}

/**
 * Upsert a single membership to the database
 * Uses timestamp to prevent stale updates (webhook arriving after newer data)
 */
export async function upsertMembership(
  ctx: MutationCtx,
  workosUserId: string,
  workosOrgId: string,
  role: string,
  timestamp: number
): Promise<"added" | "updated" | "skipped"> {
  // Check if membership already exists
  const existing = await ctx.db
    .query("userOrgMemberships")
    .withIndex("by_user_org", (q) =>
      q.eq("workosUserId", workosUserId).eq("workosOrgId", workosOrgId)
    )
    .first();

  if (existing) {
    // Only update if this data is newer than what we have
    // Handle both updatedAt (new) and syncedAt (legacy) field names
    const existingTimestamp = existing.updatedAt ?? existing.syncedAt ?? 0;
    if (timestamp > existingTimestamp) {
      await ctx.db.patch(existing._id, {
        role,
        updatedAt: timestamp,
      });
      return "updated";
    }
    return "skipped"; // Data is stale, ignore
  }

  // Create new membership
  await ctx.db.insert("userOrgMemberships", {
    workosUserId,
    workosOrgId,
    role,
    updatedAt: timestamp,
  });
  return "added";
}

/**
 * Remove a membership from the database
 * Uses timestamp to prevent stale deletes
 */
export async function removeMembership(
  ctx: MutationCtx,
  workosUserId: string,
  workosOrgId: string,
  timestamp: number
): Promise<boolean> {
  const existing = await ctx.db
    .query("userOrgMemberships")
    .withIndex("by_user_org", (q) =>
      q.eq("workosUserId", workosUserId).eq("workosOrgId", workosOrgId)
    )
    .first();

  if (existing) {
    // Handle both updatedAt (new) and syncedAt (legacy) field names
    const existingTimestamp = existing.updatedAt ?? existing.syncedAt ?? 0;
    if (timestamp > existingTimestamp) {
      await ctx.db.delete(existing._id);
      return true;
    }
  }
  return false;
}

/**
 * Log a sync operation for debugging
 */
export async function logSync(
  ctx: MutationCtx,
  type: SyncType,
  status: string,
  workosUserId?: string,
  details?: string
): Promise<void> {
  await ctx.db.insert("syncLog", {
    type,
    workosUserId,
    status,
    details,
    timestamp: Date.now(),
  });
}

/**
 * Sync all memberships for a single user
 * Called from actions that fetch from WorkOS API
 */
export async function syncUserMembershipsFromData(
  ctx: MutationCtx,
  workosUserId: string,
  memberships: Array<{ orgId: string; role: string }>,
  timestamp: number
): Promise<SyncResult> {
  const result: SyncResult = {
    added: 0,
    updated: 0,
    removed: 0,
    errors: [],
  };

  // Get existing memberships for this user
  const existingMemberships = await ctx.db
    .query("userOrgMemberships")
    .withIndex("by_user", (q) => q.eq("workosUserId", workosUserId))
    .collect();

  const newOrgIds = new Set(memberships.map((m) => m.orgId));

  // Upsert memberships from WorkOS
  for (const membership of memberships) {
    try {
      const action = await upsertMembership(
        ctx,
        workosUserId,
        membership.orgId,
        membership.role,
        timestamp
      );
      if (action === "added") result.added++;
      else if (action === "updated") result.updated++;
    } catch (error) {
      result.errors.push(`Failed to upsert ${membership.orgId}: ${error}`);
    }
  }

  // Remove memberships that no longer exist in WorkOS
  for (const existing of existingMemberships) {
    if (!newOrgIds.has(existing.workosOrgId)) {
      try {
        const removed = await removeMembership(
          ctx,
          workosUserId,
          existing.workosOrgId,
          timestamp
        );
        if (removed) result.removed++;
      } catch (error) {
        result.errors.push(`Failed to remove ${existing.workosOrgId}: ${error}`);
      }
    }
  }

  return result;
}

/**
 * Get all memberships for a user from Convex
 */
export async function getUserMemberships(
  ctx: MutationCtx | ActionCtx,
  workosUserId: string
): Promise<Array<{ orgId: string; role: string }>> {
  // For ActionCtx, we need to use runQuery, but for MutationCtx we can query directly
  // This function is primarily called from mutations, so we assume MutationCtx
  const memberships = await (ctx as MutationCtx).db
    .query("userOrgMemberships")
    .withIndex("by_user", (q) => q.eq("workosUserId", workosUserId))
    .collect();

  return memberships.map((m) => ({
    orgId: m.workosOrgId,
    role: m.role,
  }));
}
