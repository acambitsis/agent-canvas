/**
 * Shared helper functions for Convex functions
 */

import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";
import { AuthContext, requireAuth, requireOrgAccess } from "./auth";

/**
 * Extract serializable agent data for history records
 * Removes Convex system fields (_id, _creationTime)
 */
export function getAgentSnapshot(agent: Doc<"agents">): Record<string, unknown> {
  const { _id, _creationTime, ...data } = agent;
  return data;
}

/**
 * Verify canvas access and return canvas
 * Throws if canvas not found or user doesn't have access
 */
export async function getCanvasWithAccess(
  ctx: QueryCtx | MutationCtx,
  auth: AuthContext,
  canvasId: Id<"canvases">
): Promise<Doc<"canvases">> {
  const canvas = await ctx.db.get(canvasId);
  if (!canvas || canvas.deletedAt) {
    throw new Error("NotFound: Canvas not found");
  }
  requireOrgAccess(auth, canvas.workosOrgId);
  return canvas;
}

/**
 * Get agent with canvas access verification
 * Throws if agent not found or user doesn't have access
 */
export async function getAgentWithAccess(
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

/**
 * Mutation wrapper that requires authentication and canvas access
 * Reduces boilerplate in mutation handlers
 */
export async function withCanvasAccess<T>(
  ctx: MutationCtx,
  canvasId: Id<"canvases">,
  handler: (ctx: MutationCtx, auth: AuthContext, canvas: Doc<"canvases">) => Promise<T>
): Promise<T> {
  const auth = await requireAuth(ctx);
  const canvas = await getCanvasWithAccess(ctx, auth, canvasId);
  return handler(ctx, auth, canvas);
}

/**
 * Mutation wrapper that requires authentication and agent access
 * Reduces boilerplate in mutation handlers
 */
export async function withAgentAccess<T>(
  ctx: MutationCtx,
  agentId: Id<"agents">,
  handler: (ctx: MutationCtx, auth: AuthContext, agent: Doc<"agents">, canvas: Doc<"canvases">) => Promise<T>
): Promise<T> {
  const auth = await requireAuth(ctx);
  const { agent, canvas } = await getAgentWithAccess(ctx, auth, agentId);
  return handler(ctx, auth, agent, canvas);
}
