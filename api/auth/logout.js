/**
 * POST /api/auth/logout
 * Clear session cookie
 */

import { clearSessionCookie, json } from '../lib/session-utils.js';

export const config = { runtime: 'edge' };

export default async function handler(request) {
  // Only allow POST to prevent CSRF via GET requests
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': clearSessionCookie(),
    },
  });
}
