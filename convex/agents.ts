import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { MutationCtx, QueryCtx } from "./_generated/server";
import { AuthContext, requireAuth, requireOrgAccess } from "./lib/auth";
import { getAgentSnapshot } from "./lib/helpers";
import {
  validateAgentName,
  validateMetrics,
  validateOptionalUrl,
  validatePhase,
} from "./lib/validation";

// Shared agent input validator for bulk operations
const agentInputValidator = v.object({
  phase: v.string(),
  phaseOrder: v.number(),
  agentOrder: v.number(),
  name: v.string(),
  objective: v.optional(v.string()),
  description: v.optional(v.string()),
  tools: v.array(v.string()),
  journeySteps: v.array(v.string()),
  demoLink: v.optional(v.string()),
  videoLink: v.optional(v.string()),
  metrics: v.optional(
    v.object({
      adoption: v.number(),
      satisfaction: v.number(),
    })
  ),
  payload: v.optional(v.any()),
});

// Helper to verify canvas access and return canvas
async function getCanvasWithAccess(
  ctx: QueryCtx | MutationCtx,
  auth: AuthContext,
  canvasId: Id<"canvases">
): Promise<Doc<"canvases">> {
  const canvas = await ctx.db.get(canvasId);
  if (!canvas || canvas.deletedAt) {
    throw new Error("NotFound: Canvas not found");
  }
  await requireOrgAccess(ctx, auth, canvas.workosOrgId);
  return canvas;
}

// Helper to get agent with canvas access verification
async function getAgentWithAccess(
  ctx: QueryCtx | MutationCtx,
  auth: AuthContext,
  agentId: Id<"agents">
): Promise<{ agent: Doc<"agents">; canvas: Doc<"canvases"> }> {
  const agent = await ctx.db.get(agentId);
  if (!agent || agent.deletedAt) {
    throw new Error("NotFound: Agent not found");
  }
  const canvas = await getCanvasWithAccess(ctx, auth, agent.canvasId);
  return { agent, canvas };
}

// Shared validation for agent data
function validateAgentData(data: {
  name: string;
  phase: string;
  metrics?: { adoption: number; satisfaction: number };
  demoLink?: string;
  videoLink?: string;
}): void {
  validateAgentName(data.name);
  validatePhase(data.phase);
  validateMetrics(data.metrics);
  validateOptionalUrl(data.demoLink, "demoLink");
  validateOptionalUrl(data.videoLink, "videoLink");
}

/**
 * List all agents for a canvas (excludes soft-deleted)
 */
export const list = query({
  args: { canvasId: v.id("canvases") },
  handler: async (ctx, { canvasId }) => {
    const auth = await requireAuth(ctx);
    await getCanvasWithAccess(ctx, auth, canvasId);

    const agents = await ctx.db
      .query("agents")
      .withIndex("by_canvas", (q) => q.eq("canvasId", canvasId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    // Sort by phaseOrder, then agentOrder
    return agents.sort((a, b) =>
      a.phaseOrder !== b.phaseOrder
        ? a.phaseOrder - b.phaseOrder
        : a.agentOrder - b.agentOrder
    );
  },
});

/**
 * Get a single agent by ID
 */
export const get = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, { agentId }) => {
    const auth = await requireAuth(ctx);
    const { agent } = await getAgentWithAccess(ctx, auth, agentId);
    return agent;
  },
});

/**
 * Create a new agent
 */
export const create = mutation({
  args: {
    canvasId: v.id("canvases"),
    phase: v.string(),
    phaseOrder: v.number(),
    agentOrder: v.number(),
    name: v.string(),
    objective: v.optional(v.string()),
    description: v.optional(v.string()),
    tools: v.array(v.string()),
    journeySteps: v.array(v.string()),
    demoLink: v.optional(v.string()),
    videoLink: v.optional(v.string()),
    metrics: v.optional(
      v.object({
        adoption: v.number(),
        satisfaction: v.number(),
      })
    ),
    payload: v.optional(v.any()), // Portable JSON payload
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);
    await getCanvasWithAccess(ctx, auth, args.canvasId);

    validateAgentData(args);

    const now = Date.now();
    const agentId = await ctx.db.insert("agents", {
      ...args,
      createdBy: auth.workosUserId,
      updatedBy: auth.workosUserId,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("agentHistory", {
      agentId,
      changedBy: auth.workosUserId,
      changedAt: now,
      changeType: "create",
      previousData: undefined,
    });

    return agentId;
  },
});

/**
 * Update an agent
 */
export const update = mutation({
  args: {
    agentId: v.id("agents"),
    phase: v.optional(v.string()),
    phaseOrder: v.optional(v.number()),
    agentOrder: v.optional(v.number()),
    name: v.optional(v.string()),
    objective: v.optional(v.string()),
    description: v.optional(v.string()),
    tools: v.optional(v.array(v.string())),
    journeySteps: v.optional(v.array(v.string())),
    demoLink: v.optional(v.string()),
    videoLink: v.optional(v.string()),
    metrics: v.optional(
      v.object({
        adoption: v.number(),
        satisfaction: v.number(),
      })
    ),
    payload: v.optional(v.any()), // Portable JSON payload
  },
  handler: async (ctx, { agentId, ...updates }) => {
    const auth = await requireAuth(ctx);
    const { agent } = await getAgentWithAccess(ctx, auth, agentId);

    // Validate provided fields
    if (updates.name !== undefined) validateAgentName(updates.name);
    if (updates.phase !== undefined) validatePhase(updates.phase);
    validateMetrics(updates.metrics);
    validateOptionalUrl(updates.demoLink, "demoLink");
    validateOptionalUrl(updates.videoLink, "videoLink");

    const now = Date.now();
    const previousData = getAgentSnapshot(agent);

    // Filter out undefined values from updates
    const definedUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    await ctx.db.patch(agentId, {
      ...definedUpdates,
      updatedBy: auth.workosUserId,
      updatedAt: now,
    });

    await ctx.db.insert("agentHistory", {
      agentId,
      changedBy: auth.workosUserId,
      changedAt: now,
      changeType: "update",
      previousData,
    });
  },
});

/**
 * Delete an agent (soft delete)
 */
export const remove = mutation({
  args: { agentId: v.id("agents") },
  handler: async (ctx, { agentId }) => {
    const auth = await requireAuth(ctx);
    const { agent } = await getAgentWithAccess(ctx, auth, agentId);

    const now = Date.now();

    // Record history before deletion
    await ctx.db.insert("agentHistory", {
      agentId,
      changedBy: auth.workosUserId,
      changedAt: now,
      changeType: "delete",
      previousData: getAgentSnapshot(agent),
    });

    // Soft delete instead of hard delete
    await ctx.db.patch(agentId, {
      deletedAt: now,
      updatedBy: auth.workosUserId,
      updatedAt: now,
    });
  },
});

/**
 * Reorder agents - update phase and order
 */
export const reorder = mutation({
  args: {
    agentId: v.id("agents"),
    phase: v.string(),
    phaseOrder: v.number(),
    agentOrder: v.number(),
  },
  handler: async (ctx, { agentId, phase, phaseOrder, agentOrder }) => {
    const auth = await requireAuth(ctx);
    await getAgentWithAccess(ctx, auth, agentId);

    await ctx.db.patch(agentId, {
      phase,
      phaseOrder,
      agentOrder,
      updatedBy: auth.workosUserId,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Bulk create agents (for import)
 */
export const bulkCreate = mutation({
  args: {
    canvasId: v.id("canvases"),
    agents: v.array(agentInputValidator),
  },
  handler: async (ctx, { canvasId, agents }) => {
    const auth = await requireAuth(ctx);
    await getCanvasWithAccess(ctx, auth, canvasId);

    // Validate all agents before inserting any
    agents.forEach(validateAgentData);

    const now = Date.now();
    const createdIds: Id<"agents">[] = [];

    for (const agentData of agents) {
      const agentId = await ctx.db.insert("agents", {
        canvasId,
        ...agentData,
        createdBy: auth.workosUserId,
        updatedBy: auth.workosUserId,
        createdAt: now,
        updatedAt: now,
      });

      await ctx.db.insert("agentHistory", {
        agentId,
        changedBy: auth.workosUserId,
        changedAt: now,
        changeType: "create",
        previousData: undefined,
      });

      createdIds.push(agentId);
    }

    return createdIds;
  },
});

/**
 * Atomically replace all agents for a canvas
 * Soft-deletes existing agents and creates new ones in a single transaction
 */
export const bulkReplace = mutation({
  args: {
    canvasId: v.id("canvases"),
    agents: v.array(agentInputValidator),
  },
  handler: async (ctx, { canvasId, agents }) => {
    const auth = await requireAuth(ctx);
    await getCanvasWithAccess(ctx, auth, canvasId);

    // Validate all agents before making any changes
    agents.forEach(validateAgentData);

    const now = Date.now();

    // Get existing non-deleted agents
    const existingAgents = await ctx.db
      .query("agents")
      .withIndex("by_canvas", (q) => q.eq("canvasId", canvasId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    // Record history and soft-delete existing agents
    for (const agent of existingAgents) {
      await ctx.db.insert("agentHistory", {
        agentId: agent._id,
        changedBy: auth.workosUserId,
        changedAt: now,
        changeType: "delete",
        previousData: getAgentSnapshot(agent),
      });

      // Soft delete instead of hard delete
      await ctx.db.patch(agent._id, {
        deletedAt: now,
        updatedBy: auth.workosUserId,
        updatedAt: now,
      });
    }

    // Create new agents
    const createdIds: Id<"agents">[] = [];
    for (const agentData of agents) {
      const agentId = await ctx.db.insert("agents", {
        canvasId,
        ...agentData,
        createdBy: auth.workosUserId,
        updatedBy: auth.workosUserId,
        createdAt: now,
        updatedAt: now,
      });

      await ctx.db.insert("agentHistory", {
        agentId,
        changedBy: auth.workosUserId,
        changedAt: now,
        changeType: "create",
        previousData: undefined,
      });

      createdIds.push(agentId);
    }

    return createdIds;
  },
});
