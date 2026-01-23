import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { MutationCtx } from "./_generated/server";
import { requireAuth, requireOrgAccess } from "./lib/auth";
import {
  getAgentSnapshot,
  getCanvasWithAccess,
  getAgentWithAccess,
} from "./lib/helpers";
import {
  validateAgentName,
  validateMetrics,
  validateOptionalUrl,
  validatePhase,
} from "./lib/validation";
import { agentFieldValidators, agentInputValidator, agentUpdateValidator } from "./lib/validators";

// Shared validation for agent data
function validateAgentData(data: Record<string, unknown>): void {
  if (typeof data.name === 'string') validateAgentName(data.name);
  if (typeof data.phase === 'string') validatePhase(data.phase);
  if (data.metrics && typeof data.metrics === 'object') {
    validateMetrics(data.metrics as {
      numberOfUsers?: number;
      timesUsed?: number;
      timeSaved?: number;
      roi?: number;
    });
  }
  if (typeof data.demoLink === 'string') validateOptionalUrl(data.demoLink, "demoLink");
  if (typeof data.videoLink === 'string') validateOptionalUrl(data.videoLink, "videoLink");
}

// Helper to record agent history
async function recordHistory(
  ctx: MutationCtx,
  agentId: Id<"agents">,
  workosUserId: string,
  changeType: "create" | "update" | "delete",
  previousData?: any
): Promise<void> {
  await ctx.db.insert("agentHistory", {
    agentId,
    changedBy: workosUserId,
    changedAt: Date.now(),
    changeType,
    previousData,
  });
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

    // Sort by agentOrder (phase ordering is determined by canvas.phases)
    return agents.sort((a, b) => a.agentOrder - b.agentOrder);
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
    agentOrder: v.number(),
    name: v.string(),
    objective: v.optional(v.string()),
    description: v.optional(v.string()),
    tools: v.array(v.string()),
    journeySteps: v.array(v.string()),
    demoLink: v.optional(v.string()),
    videoLink: v.optional(v.string()),
    metrics: agentFieldValidators.metrics,
    category: v.optional(v.string()),
    status: agentFieldValidators.status,
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

    await recordHistory(ctx, agentId, auth.workosUserId, "create");

    return agentId;
  },
});

/**
 * Update an agent
 */
export const update = mutation({
  args: {
    agentId: v.id("agents"),
    ...agentUpdateValidator,
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

    await recordHistory(ctx, agentId, auth.workosUserId, "update", previousData);
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

    await recordHistory(ctx, agentId, auth.workosUserId, "delete", getAgentSnapshot(agent));

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
    agentOrder: v.number(),
  },
  handler: async (ctx, { agentId, phase, agentOrder }) => {
    const auth = await requireAuth(ctx);
    await getAgentWithAccess(ctx, auth, agentId);

    const now = Date.now();

    await ctx.db.patch(agentId, {
      phase,
      agentOrder,
      updatedBy: auth.workosUserId,
      updatedAt: now,
    });
  },
});

/**
 * Rename a phase by updating all agents with that phase name
 * Also updates the canvas.phases array
 */
export const renamePhase = mutation({
  args: {
    canvasId: v.id("canvases"),
    fromPhase: v.string(),
    toPhase: v.string(),
  },
  handler: async (ctx, { canvasId, fromPhase, toPhase }) => {
    const auth = await requireAuth(ctx);
    const canvas = await getCanvasWithAccess(ctx, auth, canvasId);

    validatePhase(fromPhase);
    validatePhase(toPhase);

    if (fromPhase === toPhase) {
      return { updatedCount: 0 };
    }

    const now = Date.now();

    // Update canvas.phases - replace fromPhase with toPhase
    const canvasPhases = canvas.phases ?? ["Backlog"];
    const phaseIndex = canvasPhases.indexOf(fromPhase);
    if (phaseIndex !== -1) {
      const newPhases = [...canvasPhases];
      newPhases[phaseIndex] = toPhase;
      await ctx.db.patch(canvasId, {
        phases: newPhases,
        updatedBy: auth.workosUserId,
        updatedAt: now,
      });
    }

    const agents = await ctx.db
      .query("agents")
      .withIndex("by_canvas", (q) => q.eq("canvasId", canvasId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const toRename = agents.filter((a) => a.phase === fromPhase);
    if (toRename.length === 0) {
      return { updatedCount: 0 };
    }

    // Apply phase rename with history tracking
    for (const agent of toRename) {
      await recordHistory(ctx, agent._id, auth.workosUserId, "update", getAgentSnapshot(agent));

      await ctx.db.patch(agent._id, {
        phase: toPhase,
        updatedBy: auth.workosUserId,
        updatedAt: now,
      });
    }

    return { updatedCount: toRename.length };
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
    const canvas = await getCanvasWithAccess(ctx, auth, canvasId);

    // Validate all agents before inserting any
    agents.forEach(validateAgentData);

    const now = Date.now();
    const createdIds: Id<"agents">[] = [];

    // Extract unique phases and categories from agents
    const newPhases = new Set<string>();
    const newCategories = new Set<string>();
    for (const agent of agents) {
      newPhases.add(agent.phase);
      if (agent.category) newCategories.add(agent.category);
    }

    // Append only NEW phases/categories not already in canvas
    // (ImportYamlModal passes phases/categories at canvas creation, so we only add extras here)
    const canvasPhases = canvas.phases ?? ["Backlog"];
    const canvasCategories = canvas.categories ?? ["Uncategorized"];
    const phasesToAdd = [...newPhases].filter(p => !canvasPhases.includes(p));
    const categoriesToAdd = [...newCategories].filter(c => !canvasCategories.includes(c));

    if (phasesToAdd.length > 0 || categoriesToAdd.length > 0) {
      await ctx.db.patch(canvasId, {
        phases: [...canvasPhases, ...phasesToAdd],
        categories: [...canvasCategories, ...categoriesToAdd],
        updatedBy: auth.workosUserId,
        updatedAt: now,
      });
    }

    for (const agentData of agents) {
      const agentId = await ctx.db.insert("agents", {
        canvasId,
        ...agentData,
        createdBy: auth.workosUserId,
        updatedBy: auth.workosUserId,
        createdAt: now,
        updatedAt: now,
      });

      await recordHistory(ctx, agentId, auth.workosUserId, "create");

      createdIds.push(agentId);
    }

    return createdIds;
  },
});

/**
 * Atomically replace all agents for a canvas
 * Soft-deletes existing agents and creates new ones in a single transaction
 * Also updates canvas phases/categories based on imported agents
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

    // Extract unique phases and categories from new agents (preserve order)
    const newPhases: string[] = [];
    const newCategories: string[] = [];
    const seenPhases = new Set<string>();
    const seenCategories = new Set<string>();
    for (const agent of agents) {
      if (!seenPhases.has(agent.phase)) {
        seenPhases.add(agent.phase);
        newPhases.push(agent.phase);
      }
      if (agent.category && !seenCategories.has(agent.category)) {
        seenCategories.add(agent.category);
        newCategories.push(agent.category);
      }
    }

    // Update canvas with new phases/categories from import
    await ctx.db.patch(canvasId, {
      phases: newPhases.length > 0 ? newPhases : ["Backlog"],
      categories: newCategories.length > 0 ? newCategories : ["Uncategorized"],
      updatedBy: auth.workosUserId,
      updatedAt: now,
    });

    // Get existing non-deleted agents
    const existingAgents = await ctx.db
      .query("agents")
      .withIndex("by_canvas", (q) => q.eq("canvasId", canvasId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    // Record history and soft-delete existing agents
    for (const agent of existingAgents) {
      await recordHistory(ctx, agent._id, auth.workosUserId, "delete", getAgentSnapshot(agent));

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

      await recordHistory(ctx, agentId, auth.workosUserId, "create");

      createdIds.push(agentId);
    }

    return createdIds;
  },
});

/**
 * Get distinct categories across all agents in an organization
 * Used for autocomplete suggestions in the agent form
 */
export const getDistinctCategories = query({
  args: { workosOrgId: v.string() },
  handler: async (ctx, { workosOrgId }) => {
    const auth = await requireAuth(ctx);
    requireOrgAccess(auth, workosOrgId);

    // Get all canvases for this org
    const canvases = await ctx.db
      .query("canvases")
      .withIndex("by_org", (q) => q.eq("workosOrgId", workosOrgId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    // Collect all categories from agents across all canvases
    const categories = new Set<string>();

    for (const canvas of canvases) {
      const agents = await ctx.db
        .query("agents")
        .withIndex("by_canvas", (q) => q.eq("canvasId", canvas._id))
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .collect();

      for (const agent of agents) {
        if (agent.category && agent.category.trim()) {
          categories.add(agent.category.trim());
        }
      }
    }

    // Return sorted array
    return Array.from(categories).sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    );
  },
});
