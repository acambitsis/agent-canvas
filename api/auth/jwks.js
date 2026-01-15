/**
 * GET /api/auth/jwks
 * Returns the JWKS (JSON Web Key Set) for verifying custom JWTs
 * Used by Convex to verify our self-signed JWTs when WorkOS doesn't return id_tokens
 */

import { getJwks, json } from '../lib/session-utils.js';

export const config = { runtime: 'edge' };

export default async function handler(request) {
  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const jwks = await getJwks();
    return new Response(JSON.stringify(jwks), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('Failed to generate JWKS:', error);
    return json({ error: 'Internal server error' }, 500);
  }
}
