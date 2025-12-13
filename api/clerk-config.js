/**
 * API endpoint to expose Clerk publishable key to frontend
 * This is safe because publishable keys are meant to be public
 */

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const publishableKey = process.env.CLERK_PUBLISHABLE_KEY;
  
  if (!publishableKey) {
    return res.status(500).json({ error: 'Clerk publishable key not configured' });
  }

  // Trim any whitespace/newlines from the key
  const cleanKey = publishableKey.trim();

  // Return as JSON
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
  return res.status(200).json({ publishableKey: cleanKey });
}

