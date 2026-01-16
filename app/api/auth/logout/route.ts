/**
 * POST /api/auth/logout
 * Clear session cookie
 */

import { clearSessionCookie, json } from '@/server/session-utils';

export const runtime = 'edge';

export async function POST() {
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': clearSessionCookie(),
    },
  });
}
