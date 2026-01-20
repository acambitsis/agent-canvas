/**
 * Reusable Convex validator components
 * Eliminates duplication in validator definitions
 */

import { v } from "convex/values";

/**
 * Shared validator components for agent fields
 */
export const agentFieldValidators = {
  // Required fields
  phase: v.string(),
  phaseOrder: v.number(),
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
  status: v.optional(v.string()),
} as const;

/**
 * Create agent input validator (for bulk create)
 * All fields required except explicitly optional ones
 */
export const agentInputValidator = v.object({
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
      numberOfUsers: v.optional(v.number()),
      timesUsed: v.optional(v.number()),
      timeSaved: v.optional(v.number()),
      roi: v.optional(v.number()),
    })
  ),
  category: v.optional(v.string()),
  status: v.optional(v.string()),
});

/**
 * Create agent update validator (all fields optional)
 */
export const agentUpdateValidator = {
  phase: v.optional(agentFieldValidators.phase),
  phaseOrder: v.optional(agentFieldValidators.phaseOrder),
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
