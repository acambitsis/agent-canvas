import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth, requireOrgAccess } from "./lib/auth";
import { Id, Doc } from "./_generated/dataModel";
import { QueryCtx, MutationCtx } from "./_generated/server";
import { AuthContext } from "./lib/auth";

// Helper to verify canvas access and return canvas
async function getCanvasWithAccess(
  ctx: QueryCtx | MutationCtx,
  auth: AuthContext,
  canvasId: Id<"canvases">
): Promise<Doc<"canvases">> {
  const canvas = await ctx.db.get(canvasId);
  if (!canvas) throw new Error("Canvas not found");
  requireOrgAccess(auth, canvas.workosOrgId);
  return canvas;
}

// Helper to get agent with canvas access verification
async function getAgentWithAccess(
  ctx: QueryCtx | MutationCtx,
  auth: AuthContext,
  agentId: Id<"agents">
): Promise<{ agent: Doc<"agents">; canvas: Doc<"canvases"> }> {
  const agent = await ctx.db.get(agentId);
  if (!agent) throw new Error("Agent not found");
  const canvas = await getCanvasWithAccess(ctx, auth, agent.canvasId);
  return { agent, canvas };
}

// Helper to extract serializable agent data for history
function getAgentSnapshot(agent: Doc<"agents">): Record<string, unknown> {
  const { _id, _creationTime, ...data } = agent;
  return data;
}

/**
 * List all agents for a canvas
 */
export const list = query({
  args: { canvasId: v.id("canvases") },
  handler: async (ctx, { canvasId }) => {
    const auth = await requireAuth(ctx);
    await getCanvasWithAccess(ctx, auth, canvasId);

    const agents = await ctx.db
      .query("agents")
      .withIndex("by_canvas", (q) => q.eq("canvasId", canvasId))
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
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);
    await getCanvasWithAccess(ctx, auth, args.canvasId);

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
  },
  handler: async (ctx, { agentId, ...updates }) => {
    const auth = await requireAuth(ctx);
    const { agent } = await getAgentWithAccess(ctx, auth, agentId);

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
 * Delete an agent
 */
export const remove = mutation({
  args: { agentId: v.id("agents") },
  handler: async (ctx, { agentId }) => {
    const auth = await requireAuth(ctx);
    const { agent } = await getAgentWithAccess(ctx, auth, agentId);

    const now = Date.now();

    // Record history before deletion (history is preserved after agent deletion)
    await ctx.db.insert("agentHistory", {
      agentId,
      changedBy: auth.workosUserId,
      changedAt: now,
      changeType: "delete",
      previousData: getAgentSnapshot(agent),
    });

    await ctx.db.delete(agentId);
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
    agents: v.array(
      v.object({
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
      })
    ),
  },
  handler: async (ctx, { canvasId, agents }) => {
    const auth = await requireAuth(ctx);
    await getCanvasWithAccess(ctx, auth, canvasId);

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
