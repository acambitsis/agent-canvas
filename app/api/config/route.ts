/**
 * API endpoint to provide client configuration
 * Returns environment variables needed by the frontend
 */
export const runtime = 'edge';

export async function GET() {
  // Try multiple possible env var names
  const convexUrl = process.env.VITE_CONVEX_URL
    || process.env.CONVEX_URL
    || process.env.NEXT_PUBLIC_CONVEX_URL
    || null;

  return new Response(JSON.stringify({
    convexUrl: convexUrl?.replace(/\\n$/, '').trim() || null
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
