/**
 * Convex authentication configuration for WorkOS AuthKit
 *
 * Uses WorkOS access tokens directly - no custom JWT generation.
 * Tokens are verified against WorkOS public JWKS.
 */

// WorkOS Client ID (public, safe to hardcode)
const clientId = "client_01KEZ54DWP5SNBAFC1DE08FMF9";

export default {
  providers: [
    // WorkOS User Management - primary auth provider
    // Access tokens from AuthKit SDK are issued by this provider
    {
      type: "customJwt" as const,
      issuer: `https://api.workos.com/user_management/${clientId}`,
      jwks: `https://api.workos.com/sso/jwks/${clientId}`,
      algorithm: "RS256" as const,
    },
    // WorkOS SSO provider (for organizations using SSO)
    {
      type: "customJwt" as const,
      issuer: "https://api.workos.com/",
      applicationID: clientId,
      jwks: `https://api.workos.com/sso/jwks/${clientId}`,
      algorithm: "RS256" as const,
    },
  ],
};
