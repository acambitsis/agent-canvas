import { query } from "./_generated/server";

/**
 * Debug query to check authentication state
 */
export const checkAuth = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      return { authenticated: false, identity: null };
    }

    return {
      authenticated: true,
      identity: {
        subject: identity.subject,
        issuer: identity.issuer,
        tokenIdentifier: identity.tokenIdentifier,
        // Include all other fields
        ...identity,
      },
    };
  },
});
