import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { requireAuth, requireOrgAccess, hasOrgAccess } from "./lib/auth";
import { getAgentSnapshot, getCanvasWithAccess } from "./lib/helpers";
import { validateSlug, validateTitle } from "./lib/validation";
import { CHANGE_TYPE } from "./lib/validators";

/**
 * Generate a unique slug in the target org by appending -copy, -copy-2, etc.
 */
function generateUniqueSlug(
  baseSlug: string,
  existingCanvases: Doc<"canvases">[]
): string {
  const existingSlugs = new Set(existingCanvases.map((c) => c.slug));

  // Try the base slug with -copy suffix first
  const candidate = `${baseSlug}-copy`;
  if (!existingSlugs.has(candidate)) {
    return candidate;
  }

  // Try -copy-2, -copy-3, etc.
  let counter = 2;
  while (existingSlugs.has(`${baseSlug}-copy-${counter}`)) {
    counter++;
  }
  return `${baseSlug}-copy-${counter}`;
}

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
    phases: v.optional(v.array(v.string())),
    categories: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { workosOrgId, title, slug, phases, categories }) => {
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
      phases: phases ?? ["Backlog"],
      categories: categories ?? ["Uncategorized"],
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
    phases: v.optional(v.array(v.string())),
    categories: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { canvasId, title, slug, phases, categories }) => {
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
    if (phases !== undefined) updates.phases = phases;
    if (categories !== undefined) updates.categories = categories;

    await ctx.db.patch(canvasId, updates);
  },
});

/**
 * Reorder phases - set the complete ordered list
 */
export const reorderPhases = mutation({
  args: {
    canvasId: v.id("canvases"),
    phases: v.array(v.string()),
  },
  handler: async (ctx, { canvasId, phases }) => {
    const auth = await requireAuth(ctx);
    await getCanvasWithAccess(ctx, auth, canvasId);

    await ctx.db.patch(canvasId, {
      phases,
      updatedBy: auth.workosUserId,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Reorder categories - set the complete ordered list
 */
export const reorderCategories = mutation({
  args: {
    canvasId: v.id("canvases"),
    categories: v.array(v.string()),
  },
  handler: async (ctx, { canvasId, categories }) => {
    const auth = await requireAuth(ctx);
    await getCanvasWithAccess(ctx, auth, canvasId);

    await ctx.db.patch(canvasId, {
      categories,
      updatedBy: auth.workosUserId,
      updatedAt: Date.now(),
    });
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
        changeType: CHANGE_TYPE.DELETE,
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

/**
 * Copy a canvas (with all its agents) to one or more other organizations
 *
 * Note: This operation is NOT atomic across organizations. If copying to org 3 of 5
 * fails (e.g., due to slug validation), orgs 1-2 will have copies but 3-5 won't.
 * The mutation will throw on the first failure.
 */
export const copyToOrgs = mutation({
  args: {
    sourceCanvasId: v.id("canvases"),
    targetOrgIds: v.array(v.string()),
    newTitle: v.string(),
  },
  handler: async (ctx, { sourceCanvasId, targetOrgIds, newTitle }) => {
    const auth = await requireAuth(ctx);

    // Validate newTitle
    validateTitle(newTitle);

    // Limit to max 10 orgs per operation
    if (targetOrgIds.length > 10) {
      throw new Error("Validation: Cannot copy to more than 10 organizations at once");
    }

    if (targetOrgIds.length === 0) {
      throw new Error("Validation: Must select at least one organization");
    }

    // Get and validate source canvas
    const sourceCanvas = await ctx.db.get(sourceCanvasId);
    if (!sourceCanvas || sourceCanvas.deletedAt) {
      throw new Error("NotFound: Source canvas not found");
    }
    requireOrgAccess(auth, sourceCanvas.workosOrgId);

    // Validate access to all target orgs (use generic error to avoid leaking org info)
    for (const orgId of targetOrgIds) {
      if (!hasOrgAccess(auth, orgId)) {
        throw new Error("Auth: No access to one or more target organizations");
      }
    }

    // Get all non-deleted agents from source canvas
    const sourceAgents = await ctx.db
      .query("agents")
      .withIndex("by_canvas", (q) => q.eq("canvasId", sourceCanvasId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const now = Date.now();
    const baseSlug = sourceCanvas.slug;
    const results: Array<{ orgId: string; canvasId: string; slug: string }> = [];

    // Extract agent data once (optimization: avoid repeated property access in loop)
    const agentDataToCopy = sourceAgents.map((agent) => ({
      name: agent.name,
      objective: agent.objective,
      description: agent.description,
      tools: agent.tools,
      journeySteps: agent.journeySteps,
      demoLink: agent.demoLink,
      videoLink: agent.videoLink,
      metrics: agent.metrics,
      category: agent.category,
      status: agent.status,
      phase: agent.phase,
      agentOrder: agent.agentOrder,
    }));

    // Copy to each target org
    for (const targetOrgId of targetOrgIds) {
      // Get existing canvases in target org for slug uniqueness check
      const existingCanvases = await ctx.db
        .query("canvases")
        .withIndex("by_org", (q) => q.eq("workosOrgId", targetOrgId))
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .collect();

      // Generate unique slug for target org and validate it
      const uniqueSlug = generateUniqueSlug(baseSlug, existingCanvases);
      validateSlug(uniqueSlug);

      // Create canvas copy (copy phases/categories from source, with fallback defaults)
      const newCanvasId = await ctx.db.insert("canvases", {
        workosOrgId: targetOrgId,
        title: newTitle,
        slug: uniqueSlug,
        phases: sourceCanvas.phases ?? ["Backlog"],
        categories: sourceCanvas.categories ?? ["Uncategorized"],
        createdBy: auth.workosUserId,
        updatedBy: auth.workosUserId,
        createdAt: now,
        updatedAt: now,
      });

      // Copy all agents to new canvas with history recording
      for (const agentData of agentDataToCopy) {
        const newAgentId = await ctx.db.insert("agents", {
          canvasId: newCanvasId,
          ...agentData,
          createdBy: auth.workosUserId,
          updatedBy: auth.workosUserId,
          createdAt: now,
          updatedAt: now,
        });

        // Record history for audit trail
        await ctx.db.insert("agentHistory", {
          agentId: newAgentId,
          changedBy: auth.workosUserId,
          changedAt: now,
          changeType: CHANGE_TYPE.CREATE,
        });
      }

      results.push({
        orgId: targetOrgId,
        canvasId: newCanvasId,
        slug: uniqueSlug,
      });
    }

    return { success: true, results };
  },
});
