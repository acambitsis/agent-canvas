import { getQueryParam, validateRedirectUrl } from '../lib/auth-utils.js';
import { createSession } from '../lib/session.js';
import { verifyAndConsumeMagicLink } from '../lib/storage.js';

function htmlErrorPage(title, message, status = 400) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      background: linear-gradient(135deg, #0a3d4d 0%, #1a5f73 100%);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
    }
    .error-container {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-radius: 12px;
      padding: 40px;
      max-width: 500px;
      text-align: center;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    }
    h1 {
      margin-top: 0;
      color: #fff;
    }
    p {
      color: rgba(255, 255, 255, 0.9);
      line-height: 1.6;
    }
    a {
      color: #17a2b8;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="error-container">
    <h1>${title}</h1>
    <p>${message}</p>
    <p><a href="/login">Return to login</a></p>
  </div>
</body>
</html>`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).setHeader('Allow', 'GET').send('Method not allowed');
  }

  try {
    const token = getQueryParam(req, 'token');
    const redirectParam = getQueryParam(req, 'redirect');

    if (!token) {
      return res.status(400)
        .setHeader('Content-Type', 'text/html')
        .send(htmlErrorPage(
          'Invalid Link',
          'This magic link is invalid. Please request a new one.'
        ));
    }

    // Verify and consume token
    const tokenData = await verifyAndConsumeMagicLink(token);

    if (!tokenData) {
      return res.status(401)
        .setHeader('Content-Type', 'text/html')
        .send(htmlErrorPage(
          'Link Expired or Invalid',
          'This magic link has expired or has already been used. Please request a new one.'
        ));
    }

    // Create session
    await createSession(res, tokenData.email);

    // Determine redirect URL
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const redirectUrl = validateRedirectUrl(
      tokenData.redirectUrl || redirectParam,
      baseUrl
    ) || '/';

    // Redirect to validated URL
    return res.status(302)
      .setHeader('Location', redirectUrl)
      .send('');

  } catch (error) {
    console.error('Error in verify:', error);
    return res.status(500)
      .setHeader('Content-Type', 'text/html')
      .send(htmlErrorPage(
        'Server Error',
        'An error occurred while verifying your magic link. Please try again.'
      ));
  }
}

