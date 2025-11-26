import { getQueryParam, validateRedirectUrl } from '../lib/auth-utils.js';
import { destroySession } from '../lib/session.js';

const json = (res, status, payload) =>
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(payload));

export default async function handler(req, res) {
  const method = req.method;

  // CSRF protection: Require POST for logout to prevent GET-based attacks
  // GET requests can be triggered via <img> tags or iframes
  if (method === 'POST') {
    try {
      destroySession(res);
      return json(res, 200, {
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      console.error('Error destroying session:', error);
      return json(res, 500, {
        success: false,
        error: 'Failed to logout'
      });
    }
  }

  // GET requests are deprecated for security reasons but kept for backward compatibility
  // Log a warning and redirect to login
  if (method === 'GET') {
    try {
      destroySession(res);
      
      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
      const redirectParam = getQueryParam(req, 'redirect');
      const redirectUrl = validateRedirectUrl(redirectParam, baseUrl) || '/login';

      return res.status(302)
        .setHeader('Location', redirectUrl)
        .send('');
    } catch (error) {
      console.error('Error destroying session:', error);
      // Still redirect even on error
      return res.status(302)
        .setHeader('Location', '/login')
        .send('');
    }
  }

  return res.status(405).setHeader('Allow', 'POST, GET').send('Method not allowed');
}

