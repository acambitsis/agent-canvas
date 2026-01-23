/**
 * Reusable Convex validator components
 * Eliminates duplication in validator definitions
 */

import { v } from "convex/values";

/**
 * Status union type validator
 */
export const statusValidator = v.optional(
  v.union(
    v.literal("in_concept"),
    v.literal("approved"),
    v.literal("in_development"),
    v.literal("in_testing"),
    v.literal("deployed"),
    v.literal("abandoned")
  )
);

/**
 * Shared validator components for agent fields
 */
export const agentFieldValidators = {
  // Required fields
  phase: v.string(),
  agentOrder: v.number(),
  name: v.string(),

  // Optional fields
  objective: v.optional(v.string()),
  description: v.optional(v.string()),
  tools: v.array(v.string()),
  journeySteps: v.array(v.string()),
  demoLink: v.optional(v.string()),
  videoLink: v.optional(v.string()),

  // Metrics - all fields optional
  metrics: v.optional(
    v.object({
      numberOfUsers: v.optional(v.number()),
      timesUsed: v.optional(v.number()),
      timeSaved: v.optional(v.number()), // hours
      roi: v.optional(v.number()), // integer currency
    })
  ),
  category: v.optional(v.string()),
  status: statusValidator,
} as const;

/**
 * Create agent input validator (for bulk create)
 * All fields required except explicitly optional ones
 */
export const agentInputValidator = v.object({
  phase: v.string(),
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
      numberOfUsers: v.optional(v.number()),
      timesUsed: v.optional(v.number()),
      timeSaved: v.optional(v.number()),
      roi: v.optional(v.number()),
    })
  ),
  category: v.optional(v.string()),
  status: statusValidator,
});

/**
 * Create agent update validator (all fields optional)
 */
export const agentUpdateValidator = {
  phase: v.optional(agentFieldValidators.phase),
  agentOrder: v.optional(agentFieldValidators.agentOrder),
  name: v.optional(agentFieldValidators.name),
  objective: agentFieldValidators.objective,
  description: agentFieldValidators.description,
  tools: v.optional(agentFieldValidators.tools),
  journeySteps: v.optional(agentFieldValidators.journeySteps),
  demoLink: agentFieldValidators.demoLink,
  videoLink: agentFieldValidators.videoLink,
  metrics: agentFieldValidators.metrics,
  category: agentFieldValidators.category,
  status: agentFieldValidators.status,
};
