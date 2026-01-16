/**
 * Convex authentication configuration for WorkOS AuthKit
 * Validates id_tokens issued by WorkOS AuthKit
 */

const clientId = process.env.WORKOS_CLIENT_ID;
if (!clientId) {
  throw new Error("WORKOS_CLIENT_ID must be set in Convex environment variables");
}

// AuthKit domain/subdomain (e.g., "smart-chefs" for smart-chefs.authkit.app)
const authkitDomain = process.env.WORKOS_AUTHKIT_DOMAIN;
if (!authkitDomain) {
  throw new Error("WORKOS_AUTHKIT_DOMAIN must be set in Convex environment variables");
}

// WorkOS AuthKit issuer and JWKS URLs
const authkitIssuer = `https://${authkitDomain}.authkit.app`;
const authkitJwks = `https://${authkitDomain}.authkit.app/oauth2/jwks`;

export default {
  providers: [
    // WorkOS AuthKit provider (production/preview)
    {
      type: "customJwt" as const,
      issuer: authkitIssuer,
      applicationID: clientId,
      jwks: authkitJwks,
      algorithm: "RS256" as const,
    },
  ],
};
