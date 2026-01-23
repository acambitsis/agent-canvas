import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Org-level settings and configuration
  orgSettings: defineTable({
    workosOrgId: v.string(),
    toolDefinitions: v.optional(v.any()), // {name, icon, color} per tool
    colorScheme: v.optional(v.any()), // Branding, theme colors
    sectionDefaults: v.optional(v.any()), // Default section formatting
    // Future: logo, feature flags, etc.
    updatedBy: v.string(),
    updatedAt: v.number(),
  }).index("by_org", ["workosOrgId"]),

  // Canvas containers belonging to an org
  canvases: defineTable({
    workosOrgId: v.string(),
    title: v.string(),
    slug: v.string(), // Document name/identifier
    phases: v.optional(v.array(v.string())), // Ordered phase names (optional for legacy data)
    categories: v.optional(v.array(v.string())), // Ordered category names (optional for legacy data)
    deletedAt: v.optional(v.number()), // Soft delete timestamp
    createdBy: v.string(), // WorkOS user ID
    updatedBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["workosOrgId"])
    .index("by_slug", ["slug"])
    .index("by_org_slug", ["workosOrgId", "slug"]),

  // Individual agents within canvases
  agents: defineTable({
    canvasId: v.id("canvases"),
    phase: v.string(), // Implementation phase: "Phase 1", "Backlog", etc.
    phaseOrder: v.optional(v.number()), // DEPRECATED: Legacy field, kept for existing data
    agentOrder: v.number(), // Sort order within phase
    name: v.string(),
    objective: v.optional(v.string()),
    description: v.optional(v.string()),
    tools: v.array(v.string()), // Tool names
    journeySteps: v.array(v.string()),
    demoLink: v.optional(v.string()),
    videoLink: v.optional(v.string()),
    metrics: v.optional(
      v.object({
        numberOfUsers: v.optional(v.number()),
        timesUsed: v.optional(v.number()),
        timeSaved: v.optional(v.number()), // hours
        roi: v.optional(v.number()), // integer currency
      })
    ),
    // Fixed tag fields for grouping and filtering (same across all orgs)
    category: v.optional(v.string()), // Visual grouping: "Recruitment", "Onboarding", etc.
    department: v.optional(v.string()), // DEPRECATED: Legacy field, use category instead
    status: v.optional(
      v.union(
        v.literal("idea"),
        v.literal("approved"),
        v.literal("wip"),
        v.literal("testing"),
        v.literal("live"),
        v.literal("shelved")
      )
    ),
    // payload removed - we're Convex-native, no need for round-trip fidelity
    deletedAt: v.optional(v.number()), // Soft delete timestamp
    createdBy: v.string(),
    updatedBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_canvas", ["canvasId"]),

  // Audit trail for agent changes
  agentHistory: defineTable({
    agentId: v.id("agents"),
    changedBy: v.string(), // WorkOS user ID
    changedAt: v.number(),
    changeType: v.union(
      v.literal("create"),
      v.literal("update"),
      v.literal("delete")
    ),
    previousData: v.optional(v.any()), // Snapshot before change
  })
    .index("by_agent", ["agentId"])
    .index("by_agent_time", ["agentId", "changedAt"]),

  // Note: User org memberships are now stored in JWT claims
  // The userOrgMemberships table has been removed - org access is verified via JWT
});
