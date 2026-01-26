/**
 * Agent Votes - Upvote/Downvote functionality for agents
 * One vote per user per agent, toggleable
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./lib/auth";
import { getAgentWithAccess, getCanvasWithAccess } from "./lib/helpers";

/**
 * Get vote counts for a single agent
 */
export const getVoteCounts = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, { agentId }) => {
    const auth = await requireAuth(ctx);
    await getAgentWithAccess(ctx, auth, agentId);

    const votes = await ctx.db
      .query("agentVotes")
      .withIndex("by_agent", (q) => q.eq("agentId", agentId))
      .collect();

    const up = votes.filter((v) => v.vote === "up").length;
    const down = votes.filter((v) => v.vote === "down").length;

    return { up, down };
  },
});

/**
 * Get the current user's vote for an agent
 */
export const getUserVote = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, { agentId }) => {
    const auth = await requireAuth(ctx);
    await getAgentWithAccess(ctx, auth, agentId);

    const existingVote = await ctx.db
      .query("agentVotes")
      .withIndex("by_user_agent", (q) =>
        q.eq("workosUserId", auth.workosUserId).eq("agentId", agentId)
      )
      .first();

    return existingVote?.vote ?? null;
  },
});

/**
 * Get vote counts for all agents in a canvas (batch query for grid view)
 */
export const getVoteCountsForCanvas = query({
  args: { canvasId: v.id("canvases") },
  handler: async (ctx, { canvasId }) => {
    const auth = await requireAuth(ctx);
    await getCanvasWithAccess(ctx, auth, canvasId);

    // Get all non-deleted agents for this canvas
    const agents = await ctx.db
      .query("agents")
      .withIndex("by_canvas", (q) => q.eq("canvasId", canvasId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    // Fetch votes for all agents in parallel using Promise.all
    //
    // Why parallel instead of sequential for loop:
    // - Convex doesn't support SQL-like JOINs or WHERE IN clauses
    // - Each agent requires a separate indexed query
    // - Sequential: queries run one-by-one (slow)
    // - Parallel: all queries start immediately, results collected together (fast)
    // - Convex queries run server-side close to the database, so N parallel
    //   queries have minimal overhead compared to traditional client-server setups
    const votesPerAgent = await Promise.all(
      agents.map((agent) =>
        ctx.db
          .query("agentVotes")
          .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
          .collect()
      )
    );

    // Build result map from parallel query results
    const result: Record<string, { up: number; down: number }> = {};
    agents.forEach((agent, index) => {
      const votes = votesPerAgent[index];
      result[agent._id] = {
        up: votes.filter((v) => v.vote === "up").length,
        down: votes.filter((v) => v.vote === "down").length,
      };
    });

    return result;
  },
});

/**
 * Get user votes for all agents in a canvas (for highlighting user's votes)
 */
export const getUserVotesForCanvas = query({
  args: { canvasId: v.id("canvases") },
  handler: async (ctx, { canvasId }) => {
    const auth = await requireAuth(ctx);
    await getCanvasWithAccess(ctx, auth, canvasId);

    // Get all non-deleted agents for this canvas
    const agents = await ctx.db
      .query("agents")
      .withIndex("by_canvas", (q) => q.eq("canvasId", canvasId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    // Fetch user's votes for all agents in parallel (see getVoteCountsForCanvas for rationale)
    const userVotes = await Promise.all(
      agents.map((agent) =>
        ctx.db
          .query("agentVotes")
          .withIndex("by_user_agent", (q) =>
            q.eq("workosUserId", auth.workosUserId).eq("agentId", agent._id)
          )
          .first()
      )
    );

    // Build result map from parallel query results
    const result: Record<string, "up" | "down"> = {};
    agents.forEach((agent, index) => {
      const vote = userVotes[index];
      if (vote) {
        result[agent._id] = vote.vote;
      }
    });

    return result;
  },
});

/**
 * Cast or change a vote on an agent
 */
export const vote = mutation({
  args: {
    agentId: v.id("agents"),
    vote: v.union(v.literal("up"), v.literal("down")),
  },
  handler: async (ctx, { agentId, vote: voteType }) => {
    const auth = await requireAuth(ctx);
    await getAgentWithAccess(ctx, auth, agentId);

    const now = Date.now();

    // Check for existing vote
    const existingVote = await ctx.db
      .query("agentVotes")
      .withIndex("by_user_agent", (q) =>
        q.eq("workosUserId", auth.workosUserId).eq("agentId", agentId)
      )
      .first();

    if (existingVote) {
      // Update existing vote
      await ctx.db.patch(existingVote._id, {
        vote: voteType,
        updatedAt: now,
      });
    } else {
      // Create new vote
      await ctx.db.insert("agentVotes", {
        agentId,
        workosUserId: auth.workosUserId,
        vote: voteType,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

/**
 * Remove a vote from an agent
 */
export const removeVote = mutation({
  args: { agentId: v.id("agents") },
  handler: async (ctx, { agentId }) => {
    const auth = await requireAuth(ctx);
    await getAgentWithAccess(ctx, auth, agentId);

    const existingVote = await ctx.db
      .query("agentVotes")
      .withIndex("by_user_agent", (q) =>
        q.eq("workosUserId", auth.workosUserId).eq("agentId", agentId)
      )
      .first();

    if (existingVote) {
      await ctx.db.delete(existingVote._id);
    }
  },
});
