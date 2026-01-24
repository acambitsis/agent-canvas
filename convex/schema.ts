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
        v.literal("in_concept"), // Legacy value, kept for backward compatibility
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

  // User organization memberships - synced from WorkOS via webhooks, cron, and manual sync
  // This table is the source of truth for org access (not JWT claims, which can be stale)
  userOrgMemberships: defineTable({
    workosUserId: v.string(),
    workosOrgId: v.string(),
    role: v.string(), // e.g., "admin", "member"
    updatedAt: v.optional(v.number()), // Timestamp for stale data protection
    syncedAt: v.optional(v.number()), // Legacy field name, kept for backward compatibility
  })
    .index("by_user", ["workosUserId"])
    .index("by_org", ["workosOrgId"])
    .index("by_user_org", ["workosUserId", "workosOrgId"]),

  // Sync log for debugging and monitoring membership synchronization
  syncLog: defineTable({
    type: v.union(v.literal("webhook"), v.literal("cron"), v.literal("manual")),
    workosUserId: v.optional(v.string()), // null for full sync (cron)
    status: v.string(), // "success", "error", etc.
    details: v.optional(v.string()), // Additional context (e.g., counts, error message)
    timestamp: v.number(),
  }).index("by_timestamp", ["timestamp"]),
});
