import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth, requireOrgAccess } from "./lib/auth";
import { getAgentSnapshot } from "./lib/helpers";
import { validateSlug, validateTitle } from "./lib/validation";

/**
 * List all canvases for an organization (excludes soft-deleted)
 */
export const list = query({
  args: { workosOrgId: v.string() },
  handler: async (ctx, { workosOrgId }) => {
    const auth = await requireAuth(ctx);
    requireOrgAccess(auth, workosOrgId);

    return ctx.db
      .query("canvases")
      .withIndex("by_org", (q) => q.eq("workosOrgId", workosOrgId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();
  },
});

/**
 * Get a single canvas by ID
 * Returns null if not found or user lacks access (for graceful error handling)
 */
export const get = query({
  args: { canvasId: v.id("canvases") },
  handler: async (ctx, { canvasId }) => {
    const auth = await requireAuth(ctx);

    const canvas = await ctx.db.get(canvasId);
    if (!canvas || canvas.deletedAt) {
      return null;
    }

    // Check org access - return null instead of throwing to avoid leaking canvas existence
    try {
      requireOrgAccess(auth, canvas.workosOrgId);
    } catch {
      return null;
    }
    return canvas;
  },
});

/**
 * Get a canvas by slug within an org (excludes soft-deleted)
 */
export const getBySlug = query({
  args: {
    workosOrgId: v.string(),
    slug: v.string(),
  },
  handler: async (ctx, { workosOrgId, slug }) => {
    const auth = await requireAuth(ctx);
    requireOrgAccess(auth, workosOrgId);

    const canvas = await ctx.db
      .query("canvases")
      .withIndex("by_org_slug", (q) =>
        q.eq("workosOrgId", workosOrgId).eq("slug", slug)
      )
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .first();

    return canvas;
  },
});

/**
 * Create a new canvas
 */
export const create = mutation({
  args: {
    workosOrgId: v.string(),
    title: v.string(),
    slug: v.string(),
  },
  handler: async (ctx, { workosOrgId, title, slug }) => {
    const auth = await requireAuth(ctx);
    requireOrgAccess(auth, workosOrgId);

    // Validate inputs
    validateTitle(title);
    validateSlug(slug);

    // Check slug doesn't already exist in org (exclude soft-deleted)
    const existing = await ctx.db
      .query("canvases")
      .withIndex("by_org_slug", (q) =>
        q.eq("workosOrgId", workosOrgId).eq("slug", slug)
      )
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .first();

    if (existing) {
      throw new Error("Validation: A canvas with this slug already exists");
    }

    const now = Date.now();

    return await ctx.db.insert("canvases", {
      workosOrgId,
      title,
      slug,
      createdBy: auth.workosUserId,
      updatedBy: auth.workosUserId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update a canvas
 */
export const update = mutation({
  args: {
    canvasId: v.id("canvases"),
    title: v.optional(v.string()),
    slug: v.optional(v.string()),
  },
  handler: async (ctx, { canvasId, title, slug }) => {
    const auth = await requireAuth(ctx);

    const canvas = await ctx.db.get(canvasId);
    if (!canvas || canvas.deletedAt) {
      throw new Error("NotFound: Canvas not found");
    }

    requireOrgAccess(auth, canvas.workosOrgId);

    // Validate inputs (only validate provided fields)
    if (title !== undefined) validateTitle(title);
    if (slug !== undefined) validateSlug(slug);

    // If changing slug, check it doesn't conflict (exclude soft-deleted)
    if (slug && slug !== canvas.slug) {
      const existing = await ctx.db
        .query("canvases")
        .withIndex("by_org_slug", (q) =>
          q.eq("workosOrgId", canvas.workosOrgId).eq("slug", slug)
        )
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .first();

      if (existing) {
        throw new Error("Validation: A canvas with this slug already exists");
      }
    }

    const updates: Record<string, unknown> = {
      updatedBy: auth.workosUserId,
      updatedAt: Date.now(),
    };
    if (title !== undefined) updates.title = title;
    if (slug !== undefined) updates.slug = slug;

    await ctx.db.patch(canvasId, updates);
  },
});

/**
 * Delete a canvas and all its agents (soft delete)
 * Preserves history records for audit trail
 */
export const remove = mutation({
  args: {
    canvasId: v.id("canvases"),
    confirmDelete: v.optional(v.boolean()),
  },
  handler: async (ctx, { canvasId, confirmDelete }) => {
    const auth = await requireAuth(ctx);

    const canvas = await ctx.db.get(canvasId);
    if (!canvas || canvas.deletedAt) {
      throw new Error("NotFound: Canvas not found");
    }

    requireOrgAccess(auth, canvas.workosOrgId);

    // Get non-deleted agents in this canvas
    const agents = await ctx.db
      .query("agents")
      .withIndex("by_canvas", (q) => q.eq("canvasId", canvasId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    // Require confirmation if canvas has agents
    if (agents.length > 0 && !confirmDelete) {
      throw new Error(
        "Validation: Canvas has agents. Pass confirmDelete: true to confirm deletion."
      );
    }

    const now = Date.now();

    // Soft delete all agents (preserve history records)
    for (const agent of agents) {
      // Record deletion in history
      await ctx.db.insert("agentHistory", {
        agentId: agent._id,
        changedBy: auth.workosUserId,
        changedAt: now,
        changeType: "delete",
        previousData: getAgentSnapshot(agent),
      });

      // Soft delete the agent
      await ctx.db.patch(agent._id, {
        deletedAt: now,
        updatedBy: auth.workosUserId,
        updatedAt: now,
      });
    }

    // Soft delete the canvas
    await ctx.db.patch(canvasId, {
      deletedAt: now,
      updatedBy: auth.workosUserId,
      updatedAt: now,
    });
  },
});
