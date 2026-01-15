/**
 * API endpoint to provide client configuration
 * Returns environment variables needed by the frontend
 */
export default function handler(req, res) {
    // Try multiple possible env var names
    const convexUrl = process.env.VITE_CONVEX_URL
        || process.env.CONVEX_URL
        || process.env.NEXT_PUBLIC_CONVEX_URL
        || null;

    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({
        convexUrl: convexUrl?.replace(/\\n$/, '').trim() || null
    });
}
