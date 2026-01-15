/**
 * Convex authentication configuration for WorkOS
 */

const clientId = process.env.WORKOS_CLIENT_ID;
if (!clientId) {
  throw new Error("WORKOS_CLIENT_ID must be set in Convex environment variables");
}

export default {
  providers: [
    {
      type: "customJwt" as const,
      issuer: "https://api.workos.com/",
      applicationID: clientId,
      jwks: `https://api.workos.com/sso/jwks/${clientId}`,
      algorithm: "RS256" as const,
    },
    {
      type: "customJwt" as const,
      issuer: `https://api.workos.com/user_management/${clientId}`,
      jwks: `https://api.workos.com/sso/jwks/${clientId}`,
      algorithm: "RS256" as const,
    },
  ],
};
