import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { requireAuth } from "./lib/auth";

/**
 * Sync user's org memberships from WorkOS
 * SECURITY: This action verifies memberships server-side by calling WorkOS API
 * to prevent client from spoofing org access.
 */
export const syncOrgMemberships = action({
  args: {},
  handler: async (ctx) => {
    const auth = await requireAuth(ctx);
    const workosApiKey = process.env.WORKOS_API_KEY;
    
    if (!workosApiKey) {
      throw new Error("WORKOS_API_KEY not configured in Convex");
    }

    // Fetch actual org memberships from WorkOS API (server-side verification)
    const response = await fetch(
      `https://api.workos.com/user_management/organization_memberships?user_id=${auth.workosUserId}`,
      { headers: { Authorization: `Bearer ${workosApiKey}` } }
    );

    if (!response.ok) {
      throw new Error(`WorkOS API error: ${response.status}`);
    }

    const data = await response.json();
    const orgMemberships = data.data || [];

    // Prepare verified memberships
    const memberships = orgMemberships.map((om) => ({
      orgId: om.organization_id,
      role: om.role?.slug || 'member',
    }));

    // Call internal mutation to update database
    await ctx.runMutation("users:updateMemberships", {
      memberships,
    });
  },
});

/**
 * Internal mutation to update memberships (called by action after verification)
 */
export const updateMemberships = mutation({
  args: {
    memberships: v.array(
      v.object({
        orgId: v.string(),
        role: v.string(),
      })
    ),
  },
  handler: async (ctx, { memberships }) => {
    const auth = await requireAuth(ctx);
    const now = Date.now();

    // Get existing memberships for this user
    const existing = await ctx.db
      .query("userOrgMemberships")
      .withIndex("by_user", (q) => q.eq("workosUserId", auth.workosUserId))
      .collect();

    const existingOrgIds = new Set(existing.map((m) => m.workosOrgId));
    const newOrgIds = new Set(memberships.map((m) => m.orgId));

    // Delete memberships that no longer exist
    for (const membership of existing) {
      if (!newOrgIds.has(membership.workosOrgId)) {
        await ctx.db.delete(membership._id);
      }
    }

    // Upsert current memberships
    for (const membership of memberships) {
      const existingMembership = existing.find(
        (m) => m.workosOrgId === membership.orgId
      );

      if (existingMembership) {
        // Update if role changed
        if (existingMembership.role !== membership.role) {
          await ctx.db.patch(existingMembership._id, {
            role: membership.role,
            syncedAt: now,
          });
        }
      } else {
        // Insert new membership
        await ctx.db.insert("userOrgMemberships", {
          workosUserId: auth.workosUserId,
          workosOrgId: membership.orgId,
          role: membership.role,
          syncedAt: now,
        });
      }
    }
  },
});

/**
 * Get user's org memberships
 */
export const getOrgMemberships = query({
  args: {},
  handler: async (ctx) => {
    const auth = await requireAuth(ctx);

    return ctx.db
      .query("userOrgMemberships")
      .withIndex("by_user", (q) => q.eq("workosUserId", auth.workosUserId))
      .collect();
  },
});
