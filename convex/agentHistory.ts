import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireAuth, requireOrgAccess } from "./lib/auth";

/**
 * List history for an agent
 */
export const list = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, { agentId }) => {
    const auth = await requireAuth(ctx);

    // Get the agent to verify access
    const agent = await ctx.db.get(agentId);
    if (!agent) {
      // Agent might be deleted, try to get history anyway if super admin
      if (!auth.isSuperAdmin) {
        throw new Error("Agent not found");
      }
    } else {
      // Verify access via canvas
      const canvas = await ctx.db.get(agent.canvasId);
      if (!canvas) {
        throw new Error("Canvas not found");
      }
      await requireOrgAccess(ctx, auth, canvas.workosOrgId);
    }

    const history = await ctx.db
      .query("agentHistory")
      .withIndex("by_agent_time", (q) => q.eq("agentId", agentId))
      .order("desc")
      .collect();

    return history;
  },
});

/**
 * Get history for all agents in a canvas
 */
export const listByCanvas = query({
  args: { canvasId: v.id("canvases") },
  handler: async (ctx, { canvasId }) => {
    const auth = await requireAuth(ctx);

    // Verify access to the canvas's org
    const canvas = await ctx.db.get(canvasId);
    if (!canvas) {
      throw new Error("Canvas not found");
    }
    await requireOrgAccess(ctx, auth, canvas.workosOrgId);

    // Get all agents in this canvas
    const agents = await ctx.db
      .query("agents")
      .withIndex("by_canvas", (q) => q.eq("canvasId", canvasId))
      .collect();

    // Fetch history for all agents in parallel
    const historyArrays = await Promise.all(
      agents.map((agent) =>
        ctx.db
          .query("agentHistory")
          .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
          .collect()
      )
    );

    // Flatten and sort by time descending
    return historyArrays.flat().sort((a, b) => b.changedAt - a.changedAt);
  },
});

/**
 * Get recent history across all canvases in an org
 * Note: For orgs with many canvases/agents, consider adding a denormalized
 * index on agentHistory with workosOrgId for better performance.
 */
export const listRecent = query({
  args: {
    workosOrgId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { workosOrgId, limit = 50 }) => {
    const auth = await requireAuth(ctx);
    await requireOrgAccess(ctx, auth, workosOrgId);

    // Get all canvases in this org
    const canvases = await ctx.db
      .query("canvases")
      .withIndex("by_org", (q) => q.eq("workosOrgId", workosOrgId))
      .collect();

    // Fetch all agents for all canvases in parallel
    const agentsByCanvas = await Promise.all(
      canvases.map(async (canvas) => ({
        canvas,
        agents: await ctx.db
          .query("agents")
          .withIndex("by_canvas", (q) => q.eq("canvasId", canvas._id))
          .collect(),
      }))
    );

    // Flatten to get all agents with their canvas info
    const allAgents = agentsByCanvas.flatMap(({ canvas, agents }) =>
      agents.map((agent) => ({ agent, canvas }))
    );

    // Fetch history for all agents in parallel
    const historyWithContext = await Promise.all(
      allAgents.map(async ({ agent, canvas }) => {
        const history = await ctx.db
          .query("agentHistory")
          .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
          .collect();
        return history.map((h) => ({
          ...h,
          canvasId: canvas._id,
          canvasTitle: canvas.title,
          agentName: agent.name,
        }));
      })
    );

    // Flatten, sort by time descending, and limit
    return historyWithContext
      .flat()
      .sort((a, b) => b.changedAt - a.changedAt)
      .slice(0, limit);
  },
});
