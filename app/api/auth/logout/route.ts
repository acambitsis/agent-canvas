/**
 * POST /api/auth/logout
 * Clear session cookie and redirect to WorkOS logout
 */

import { clearSessionCookie } from '@/server/session-utils';

export const runtime = 'edge';

export async function POST() {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const authkitDomain = process.env.WORKOS_AUTHKIT_DOMAIN;

  // Build WorkOS logout URL that redirects back to our login page
  const logoutUrl = authkitDomain
    ? `https://${authkitDomain}.authkit.app/signout?redirect_uri=${encodeURIComponent(`${baseUrl}/login`)}`
    : `${baseUrl}/login`;

  return new Response(JSON.stringify({ success: true, logoutUrl }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': clearSessionCookie(),
    },
  });
}
