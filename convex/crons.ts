/**
 * Convex cron jobs
 *
 * Scheduled tasks for background maintenance operations
 */

import { cronJobs } from "convex/server";
import { v } from "convex/values";
import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { logSync } from "./lib/membershipSync";

const crons = cronJobs();

/**
 * Daily membership reconciliation
 *
 * Runs at 3am UTC to catch any missed webhook events and fix data drift.
 * This is a safety net - webhooks should handle most sync operations in real-time.
 */
crons.daily(
  "reconcile-memberships",
  { hourUTC: 3, minuteUTC: 0 },
  internal.crons.reconcileMemberships
);

/**
 * Internal action that performs the actual reconciliation
 * Fetches all memberships from WorkOS and syncs to Convex
 */
export const reconcileMemberships = internalAction({
  args: {},
  handler: async (ctx) => {
    const apiKey = process.env.WORKOS_API_KEY;
    if (!apiKey) {
      console.error("WORKOS_API_KEY not configured for cron job");
      await ctx.runMutation(internal.crons.logCronError, {
        error: "WORKOS_API_KEY not configured",
      });
      return;
    }

    console.log("Starting daily membership reconciliation...");

    try {
      // Fetch all organization memberships from WorkOS
      let allMemberships: Array<{
        user_id: string;
        organization_id: string;
        role?: { slug: string };
      }> = [];
      let after: string | undefined;

      do {
        const url = new URL(
          "https://api.workos.com/user_management/organization_memberships"
        );
        url.searchParams.set("limit", "100");
        if (after) url.searchParams.set("after", after);

        const response = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${apiKey}` },
        });

        if (!response.ok) {
          throw new Error(`WorkOS API error: ${response.status}`);
        }

        const data = await response.json();
        allMemberships = allMemberships.concat(data.data || []);
        after = data.list_metadata?.after;
      } while (after);

      // Group by user
      const membershipsByUser = new Map<
        string,
        Array<{ orgId: string; role: string }>
      >();
      for (const m of allMemberships) {
        const userId = m.user_id;
        if (!membershipsByUser.has(userId)) {
          membershipsByUser.set(userId, []);
        }
        membershipsByUser.get(userId)!.push({
          orgId: m.organization_id,
          role: m.role?.slug || "member",
        });
      }

      // Sync each user
      let totalAdded = 0;
      let totalUpdated = 0;
      let totalRemoved = 0;
      const errors: string[] = [];

      for (const [userId, memberships] of membershipsByUser) {
        try {
          const result = await ctx.runMutation(
            internal.orgMemberships.syncFromFetchedData,
            {
              workosUserId: userId,
              memberships,
              syncType: "cron" as const,
            }
          );
          totalAdded += result.added;
          totalUpdated += result.updated;
          totalRemoved += result.removed;
          errors.push(...result.errors);
        } catch (error) {
          errors.push(`Failed to sync user ${userId}: ${error}`);
        }
      }

      // Log the cron result
      await ctx.runMutation(internal.crons.logCronSuccess, {
        usersProcessed: membershipsByUser.size,
        added: totalAdded,
        updated: totalUpdated,
        removed: totalRemoved,
        errorCount: errors.length,
      });

      console.log(
        `Membership reconciliation complete: ${membershipsByUser.size} users, ` +
          `${totalAdded} added, ${totalUpdated} updated, ${totalRemoved} removed, ` +
          `${errors.length} errors`
      );
    } catch (error) {
      console.error("Membership reconciliation failed:", error);
      await ctx.runMutation(internal.crons.logCronError, {
        error: String(error),
      });
    }
  },
});

/**
 * Log successful cron run
 */
export const logCronSuccess = internalMutation({
  args: {
    usersProcessed: v.number(),
    added: v.number(),
    updated: v.number(),
    removed: v.number(),
    errorCount: v.number(),
  },
  handler: async (ctx, args) => {
    await logSync(
      ctx,
      "cron",
      args.errorCount > 0 ? "partial" : "success",
      undefined,
      `users=${args.usersProcessed}, added=${args.added}, updated=${args.updated}, removed=${args.removed}, errors=${args.errorCount}`
    );
  },
});

/**
 * Log cron error
 */
export const logCronError = internalMutation({
  args: {
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await logSync(ctx, "cron", "error", undefined, args.error);
  },
});

export default crons;
