/**
 * GET /api/auth/session
 * Get current session info
 */

export const config = { runtime: 'edge' };

function parseSession(request) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/session=([^;]+)/);
  if (!match) return null;
  try {
    return JSON.parse(atob(match[1]));
  } catch {
    return null;
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async function handler(request) {
  const session = parseSession(request);
  if (!session) {
    return json({ authenticated: false });
  }
  return json({
    authenticated: true,
    user: session.user,
    orgs: session.orgs || [],
  });
}
