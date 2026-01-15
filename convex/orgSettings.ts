import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth, requireOrgAccess } from "./lib/auth";

/**
 * Get org settings for an organization
 */
export const get = query({
  args: { workosOrgId: v.string() },
  handler: async (ctx, { workosOrgId }) => {
    const auth = await requireAuth(ctx);
    await requireOrgAccess(ctx, auth, workosOrgId);

    const settings = await ctx.db
      .query("orgSettings")
      .withIndex("by_org", (q) => q.eq("workosOrgId", workosOrgId))
      .first();

    return settings;
  },
});

/**
 * Update org settings (creates if doesn't exist)
 */
export const update = mutation({
  args: {
    workosOrgId: v.string(),
    toolDefinitions: v.optional(v.any()),
    colorScheme: v.optional(v.any()),
    sectionDefaults: v.optional(v.any()),
  },
  handler: async (ctx, { workosOrgId, toolDefinitions, colorScheme, sectionDefaults }) => {
    const auth = await requireAuth(ctx);
    await requireOrgAccess(ctx, auth, workosOrgId);

    const existing = await ctx.db
      .query("orgSettings")
      .withIndex("by_org", (q) => q.eq("workosOrgId", workosOrgId))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...(toolDefinitions !== undefined && { toolDefinitions }),
        ...(colorScheme !== undefined && { colorScheme }),
        ...(sectionDefaults !== undefined && { sectionDefaults }),
        updatedBy: auth.workosUserId,
        updatedAt: now,
      });
      return existing._id;
    }

    // Create new settings
    return await ctx.db.insert("orgSettings", {
      workosOrgId,
      toolDefinitions: toolDefinitions || null,
      colorScheme: colorScheme || null,
      sectionDefaults: sectionDefaults || null,
      updatedBy: auth.workosUserId,
      updatedAt: now,
    });
  },
});

/**
 * Initialize default org settings
 */
export const initDefaults = mutation({
  args: { workosOrgId: v.string() },
  handler: async (ctx, { workosOrgId }) => {
    const auth = await requireAuth(ctx);
    await requireOrgAccess(ctx, auth, workosOrgId);

    const existing = await ctx.db
      .query("orgSettings")
      .withIndex("by_org", (q) => q.eq("workosOrgId", workosOrgId))
      .first();

    if (existing) {
      return existing._id;
    }

    // Default tool definitions
    const defaultToolDefinitions = {
      Forms: { icon: "clipboard-list", color: "#17a2b8" },
      Email: { icon: "mail", color: "#28a745" },
      "Google Sheets": { icon: "table", color: "#34a853" },
      Calendar: { icon: "calendar", color: "#4285f4" },
      Code: { icon: "code", color: "#6f42c1" },
      Database: { icon: "database", color: "#fd7e14" },
      API: { icon: "plug", color: "#dc3545" },
      Chat: { icon: "message-circle", color: "#20c997" },
    };

    // Default section formatting
    const defaultSectionDefaults = {
      color: "#17a2b8",
      iconType: "lucide",
      showInFlow: true,
      isSupport: false,
    };

    return await ctx.db.insert("orgSettings", {
      workosOrgId,
      toolDefinitions: defaultToolDefinitions,
      colorScheme: null,
      sectionDefaults: defaultSectionDefaults,
      updatedBy: auth.workosUserId,
      updatedAt: Date.now(),
    });
  },
});
