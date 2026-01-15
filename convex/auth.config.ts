/**
 * Convex authentication configuration for WorkOS and custom JWTs
 */

const clientId = process.env.WORKOS_CLIENT_ID;
if (!clientId) {
  throw new Error("WORKOS_CLIENT_ID must be set in Convex environment variables");
}

// Static JWKS embedded as data URI (public key for verifying custom JWTs)
// This matches the JWT_PRIVATE_KEY used to sign tokens in the Vercel app
const staticJwksDataUri = "data:application/json;base64,eyJrZXlzIjpbeyJrdHkiOiJSU0EiLCJuIjoid3pHam9HQkZyZ3M5WTlGcWt4QVNhd1BxS29mSnhwUUo0VXlNOFZUcEM3anV6ZHZYV1hHTzczcUVJbGRlTWlMTjRLdFNXMFJ2TmdvSDU2eEpuTXY4bm0tcGxoUzlvQThNY3ZjTjdGamk2SlpvVV9aVk9CVnJ3OVhjZXQtUzlYQWVGSkx5Y080cFlCQko5NndqVnhYNFUtdkFFYVZjbjZKUFlLWEZqZVZ6NnkxMXV4OTFRUDhRc2IzZjRsTjJ1a3d5dk9qZXdDQ0dlNDBYdUxiazc0ZmpVZF9McVBPM0VhQnVrYnlJRW1XalBPMk10WUctQWkwRE55bV9pUlUwLVZidkdoVzZiaXJVcDZIZWJ6TTFhY1dlSlEyMkR3YjZPZGRqNVVaYXF4azI5bzZOT1AzMmpnRWlFazVjY2ZaMm1tSHhBRnAyZWtuMjJZWm93Zm5WS01hZHp3IiwiZSI6IkFRQUIiLCJraWQiOiJhZ2VudGNhbnZhcy1zdGF0aWMtMSIsInVzZSI6InNpZyIsImFsZyI6IlJTMjU2In1dfQ==";

export default {
  providers: [
    // WorkOS SSO provider
    {
      type: "customJwt" as const,
      issuer: "https://api.workos.com/",
      applicationID: clientId,
      jwks: `https://api.workos.com/sso/jwks/${clientId}`,
      algorithm: "RS256" as const,
    },
    // WorkOS User Management provider
    {
      type: "customJwt" as const,
      issuer: `https://api.workos.com/user_management/${clientId}`,
      jwks: `https://api.workos.com/sso/jwks/${clientId}`,
      algorithm: "RS256" as const,
    },
    // Custom JWT provider for local development (http://localhost:3000)
    {
      type: "customJwt" as const,
      issuer: "http://localhost:3000",
      applicationID: "convex",
      jwks: staticJwksDataUri,
      algorithm: "RS256" as const,
    },
    // Custom JWT provider for production (update this URL for your deployment)
    {
      type: "customJwt" as const,
      issuer: "https://agent-canvas.vercel.app",
      applicationID: "convex",
      jwks: staticJwksDataUri,
      algorithm: "RS256" as const,
    },
  ],
};
