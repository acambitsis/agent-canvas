/**
 * GET /api/jwks
 * Serve public keys for JWT verification (JWKS format)
 */

export const runtime = 'edge';

const publicKey = {
  "kty": "RSA",
  "n": "7gNsVbZrWYm26x9fQu01S9_PCVIq60BYkggGZICSqMzFnjY-l_DCexR0X_PTz0pGcDRl4juK2j2EnaEjdKV-_vIyDhxnGNrCnUGUANCVyc8W7JT57o7NT7cTxiwgmZKvq4YL4kdg7INwGiXXD3mXP9ZbycVXSi5j0Y6_RMzmyDd_9z37Mqw2wJzQEHs2WsTNYhBbz948jR-EOnrFp1Ul4rnpp_a-Dx2kNan5O9X4btbHipr4G0LZ0rx6yR14OCIVBks1zzz71ebl9nJJvGH6xmGpVUM3yJ72TaJ8Oc4juxi8Yn2KshT4gDE5YOWBVPbN9T2pgBMCU2jJZ5jaesP5cw",
  "e": "AQAB",
  "kid": "agentcanvas-static-1",
  "use": "sig",
  "alg": "RS256"
};

export async function GET() {
  return new Response(JSON.stringify({ keys: [publicKey] }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
