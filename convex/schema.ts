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
    sourceYaml: v.optional(v.string()), // Optional original YAML for import/export
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
    phase: v.string(), // Grouping: "Sales", "Design", etc.
    phaseOrder: v.number(), // Sort order for phases
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
        adoption: v.number(),
        satisfaction: v.number(),
      })
    ),
    // Typed tag fields for dynamic grouping and filtering
    tags: v.optional(
      v.object({
        department: v.optional(v.string()), // "sales", "engineering", "marketing", etc.
        status: v.optional(v.string()), // "active", "draft", "deprecated"
        implementationStatus: v.optional(v.string()), // "planning", "in-progress", "deployed"
        priority: v.optional(v.string()), // "p0", "p1", "p2", "p3"
        owner: v.optional(v.string()), // User/team identifier
      })
    ),
    payload: v.optional(v.any()), // Portable JSON payload for round-trip fidelity and extensibility
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

  // User org memberships - synced from WorkOS on login
  userOrgMemberships: defineTable({
    workosUserId: v.string(),
    workosOrgId: v.string(),
    role: v.string(), // e.g., "admin", "member"
    syncedAt: v.number(),
  })
    .index("by_user", ["workosUserId"])
    .index("by_org", ["workosOrgId"])
    .index("by_user_org", ["workosUserId", "workosOrgId"]),
});
