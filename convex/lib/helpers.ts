/**
 * Shared helper functions for Convex functions
 */

import { Doc } from "../_generated/dataModel";

/**
 * Extract serializable agent data for history records
 * Removes Convex system fields (_id, _creationTime)
 */
export function getAgentSnapshot(agent: Doc<"agents">): Record<string, unknown> {
  const { _id, _creationTime, ...data } = agent;
  return data;
}
