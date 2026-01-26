/**
 * File Storage - Convex file upload/download utilities
 *
 * Used for uploading screenshots and other user-provided files.
 * Files are stored in Convex's built-in file storage with public URLs.
 */
import { mutation } from "./_generated/server";
import { requireAuth } from "./lib/auth";

/**
 * Generate a presigned upload URL for client-side file upload
 * The URL is valid for a short time and allows direct upload to Convex storage
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});
