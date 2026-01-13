import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth, requireOrgAccess } from "./lib/auth";

/**
 * List all canvases for an organization
 */
export const list = query({
  args: { workosOrgId: v.string() },
  handler: async (ctx, { workosOrgId }) => {
    const auth = await requireAuth(ctx);
    requireOrgAccess(auth, workosOrgId);

    return ctx.db
      .query("canvases")
      .withIndex("by_org", (q) => q.eq("workosOrgId", workosOrgId))
      .collect();
  },
});

/**
 * Get a single canvas by ID
 */
export const get = query({
  args: { canvasId: v.id("canvases") },
  handler: async (ctx, { canvasId }) => {
    const auth = await requireAuth(ctx);

    const canvas = await ctx.db.get(canvasId);
    if (!canvas) {
      throw new Error("Canvas not found");
    }

    requireOrgAccess(auth, canvas.workosOrgId);
    return canvas;
  },
});

/**
 * Get a canvas by slug within an org
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

    // Check slug doesn't already exist in org
    const existing = await ctx.db
      .query("canvases")
      .withIndex("by_org_slug", (q) =>
        q.eq("workosOrgId", workosOrgId).eq("slug", slug)
      )
      .first();

    if (existing) {
      throw new Error("A canvas with this slug already exists");
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
    if (!canvas) {
      throw new Error("Canvas not found");
    }

    requireOrgAccess(auth, canvas.workosOrgId);

    // If changing slug, check it doesn't conflict
    if (slug && slug !== canvas.slug) {
      const existing = await ctx.db
        .query("canvases")
        .withIndex("by_org_slug", (q) =>
          q.eq("workosOrgId", canvas.workosOrgId).eq("slug", slug)
        )
        .first();

      if (existing) {
        throw new Error("A canvas with this slug already exists");
      }
    }

    await ctx.db.patch(canvasId, {
      ...(title && { title }),
      ...(slug && { slug }),
      updatedBy: auth.workosUserId,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Delete a canvas and all its agents
 */
export const remove = mutation({
  args: { canvasId: v.id("canvases") },
  handler: async (ctx, { canvasId }) => {
    const auth = await requireAuth(ctx);

    const canvas = await ctx.db.get(canvasId);
    if (!canvas) {
      throw new Error("Canvas not found");
    }

    requireOrgAccess(auth, canvas.workosOrgId);

    // Delete all agents in this canvas
    const agents = await ctx.db
      .query("agents")
      .withIndex("by_canvas", (q) => q.eq("canvasId", canvasId))
      .collect();

    for (const agent of agents) {
      // Delete agent history first
      const history = await ctx.db
        .query("agentHistory")
        .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
        .collect();

      for (const entry of history) {
        await ctx.db.delete(entry._id);
      }

      await ctx.db.delete(agent._id);
    }

    // Delete the canvas
    await ctx.db.delete(canvasId);
  },
});
