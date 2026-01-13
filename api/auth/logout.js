/**
 * POST /api/auth/logout
 * Clear session cookie
 */

export const config = { runtime: 'edge' };

export default async function handler() {
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': 'session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0',
    },
  });
}
