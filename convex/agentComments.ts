/**
 * Agent Comments - Simple flat comments on agents
 * Supports create, edit (own), and soft-delete (own or admin)
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth, isOrgAdmin } from "./lib/auth";
import { getAgentWithAccess, getCanvasWithAccess } from "./lib/helpers";

const MAX_COMMENT_LENGTH = 2000;

/**
 * List comments for an agent (excludes soft-deleted)
 * Returns newest first
 */
export const list = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, { agentId }) => {
    const auth = await requireAuth(ctx);
    await getAgentWithAccess(ctx, auth, agentId);

    const comments = await ctx.db
      .query("agentComments")
      .withIndex("by_agent_time", (q) => q.eq("agentId", agentId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    // Return with isOwner flag for each comment
    return comments
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((comment) => ({
        ...comment,
        isOwner: comment.workosUserId === auth.workosUserId,
      }));
  },
});

/**
 * Get comment counts for all agents in a canvas (batch query for grid view)
 */
export const getCommentCountsForCanvas = query({
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

    // Fetch comments for all agents in parallel (see agentVotes.ts for detailed rationale)
    const commentsPerAgent = await Promise.all(
      agents.map((agent) =>
        ctx.db
          .query("agentComments")
          .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
          .filter((q) => q.eq(q.field("deletedAt"), undefined))
          .collect()
      )
    );

    // Build result map from parallel query results
    const result: Record<string, number> = {};
    agents.forEach((agent, index) => {
      result[agent._id] = commentsPerAgent[index].length;
    });

    return result;
  },
});

/**
 * Create a new comment on an agent
 */
export const create = mutation({
  args: {
    agentId: v.id("agents"),
    content: v.string(),
    // Optional email from frontend (WorkOS access tokens may not include email)
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, { agentId, content, userEmail }) => {
    const auth = await requireAuth(ctx);
    await getAgentWithAccess(ctx, auth, agentId);

    // Validate content
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      throw new Error("Validation: Comment cannot be empty");
    }
    if (trimmedContent.length > MAX_COMMENT_LENGTH) {
      throw new Error(`Validation: Comment cannot exceed ${MAX_COMMENT_LENGTH} characters`);
    }

    const now = Date.now();

    // Prefer email from frontend, fallback to auth.email
    const email = userEmail || auth.email;

    const commentId = await ctx.db.insert("agentComments", {
      agentId,
      workosUserId: auth.workosUserId,
      userEmail: email,
      content: trimmedContent,
      createdAt: now,
      updatedAt: now,
    });

    return commentId;
  },
});

/**
 * Update own comment
 */
export const update = mutation({
  args: {
    commentId: v.id("agentComments"),
    content: v.string(),
  },
  handler: async (ctx, { commentId, content }) => {
    const auth = await requireAuth(ctx);

    const comment = await ctx.db.get(commentId);
    if (!comment || comment.deletedAt) {
      throw new Error("NotFound: Comment not found");
    }

    // Verify agent access
    await getAgentWithAccess(ctx, auth, comment.agentId);

    // Only owner can edit
    if (comment.workosUserId !== auth.workosUserId) {
      throw new Error("Auth: Can only edit your own comments");
    }

    // Validate content
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      throw new Error("Validation: Comment cannot be empty");
    }
    if (trimmedContent.length > MAX_COMMENT_LENGTH) {
      throw new Error(`Validation: Comment cannot exceed ${MAX_COMMENT_LENGTH} characters`);
    }

    await ctx.db.patch(commentId, {
      content: trimmedContent,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Soft-delete a comment (owner or org admin)
 */
export const remove = mutation({
  args: { commentId: v.id("agentComments") },
  handler: async (ctx, { commentId }) => {
    const auth = await requireAuth(ctx);

    const comment = await ctx.db.get(commentId);
    if (!comment || comment.deletedAt) {
      throw new Error("NotFound: Comment not found");
    }

    // Get agent to check org access
    const { canvas } = await getAgentWithAccess(ctx, auth, comment.agentId);

    // Allow deletion by owner or org admin
    const canDelete =
      comment.workosUserId === auth.workosUserId ||
      isOrgAdmin(auth, canvas.workosOrgId);

    if (!canDelete) {
      throw new Error("Auth: Cannot delete this comment");
    }

    await ctx.db.patch(commentId, {
      deletedAt: Date.now(),
    });
  },
});
