import { nanoid } from 'nanoid';
import { checkEmailAllowlist, getClientIP, normalizeEmail, validateEmail, validateRedirectUrl } from '../lib/auth-utils.js';
import { sendMagicLinkEmail } from '../lib/email.js';
import { checkRateLimit, storeMagicLink } from '../lib/storage.js';

const RATE_LIMIT_IP = { maxRequests: 10, windowSeconds: 15 * 60 }; // 10 requests per 15 minutes
const RATE_LIMIT_EMAIL = { maxRequests: 5, windowSeconds: 15 * 60 }; // 5 requests per 15 minutes
const TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes

export const config = {
  api: {
    bodyParser: true,
  },
};

const json = (res, status, payload) =>
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(payload));

async function readBody(req) {
  if (req.body) {
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  }
  
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString('utf8');
        resolve(JSON.parse(body));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).setHeader('Allow', 'POST').send('Method not allowed');
  }

  try {
    const body = await readBody(req);
    const { email, redirectUrl } = body || {};

    // Rate limit by IP
    const clientIP = getClientIP(req);
    const ipRateLimit = await checkRateLimit(clientIP, RATE_LIMIT_IP);
    
    if (!ipRateLimit.allowed) {
      const retryAfter = ipRateLimit.resetAt - Math.floor(Date.now() / 1000);
      res.status(429)
        .setHeader('Retry-After', retryAfter.toString())
        .setHeader('X-RateLimit-Limit', RATE_LIMIT_IP.maxRequests.toString())
        .setHeader('X-RateLimit-Remaining', '0')
        .setHeader('X-RateLimit-Reset', ipRateLimit.resetAt.toString());
      return json(res, 429, {
        success: false,
        error: 'Too many requests. Please try again later.'
      });
    }

    // Validate email format
    if (!email || !validateEmail(email)) {
      return json(res, 400, {
        success: false,
        error: 'Invalid email format'
      });
    }

    const normalizedEmail = normalizeEmail(email);

    // Rate limit by email
    const emailRateLimit = await checkRateLimit(normalizedEmail, RATE_LIMIT_EMAIL);
    
    if (!emailRateLimit.allowed) {
      const retryAfter = emailRateLimit.resetAt - Math.floor(Date.now() / 1000);
      res.status(429)
        .setHeader('Retry-After', retryAfter.toString())
        .setHeader('X-RateLimit-Limit', RATE_LIMIT_EMAIL.maxRequests.toString())
        .setHeader('X-RateLimit-Remaining', '0')
        .setHeader('X-RateLimit-Reset', emailRateLimit.resetAt.toString());
      return json(res, 429, {
        success: false,
        error: 'Too many requests. Please try again later.'
      });
    }

    // Check email allowlist (checks both env var and KV storage)
    console.log('Checking allowlist for:', normalizedEmail);
    console.log('ALLOWED_EMAILS env:', process.env.ALLOWED_EMAILS);
    const isAllowed = await checkEmailAllowlist(normalizedEmail);
    console.log('isAllowed:', isAllowed);
    if (!isAllowed) {
      // Return generic success message (don't reveal if email exists)
      return json(res, 200, {
        success: true,
        message: 'If that email is registered, a magic link has been sent.'
      });
    }

    // Validate redirect URL
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const validatedRedirect = validateRedirectUrl(redirectUrl, baseUrl);

    // Generate token
    const token = nanoid(32);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_SECONDS * 1000).toISOString();

    // Store token
    await storeMagicLink(token, {
      email: normalizedEmail,
      expiresAt,
      redirectUrl: validatedRedirect || null
    }, TOKEN_TTL_SECONDS);

    // Construct magic link URL
    const magicLinkUrl = `${baseUrl}/api/auth/verify?token=${token}${validatedRedirect ? `&redirect=${encodeURIComponent(validatedRedirect)}` : ''}`;

    // Send email
    const emailResult = await sendMagicLinkEmail(normalizedEmail, magicLinkUrl);
    
    if (!emailResult.success) {
      // Log error with context for monitoring/alerting
      console.error('Failed to send magic link email:', {
        email: normalizedEmail,
        error: emailResult.error,
        timestamp: new Date().toISOString()
      });
      
      // If email is in allowlist but sending failed, this is a real problem
      // We still return success to user (security best practice - don't reveal email existence)
      // but log it for monitoring/alerting
      // In production, consider sending to error tracking service (e.g., Sentry)
    }

    // Return generic success message (same regardless of email allowlist status)
    return json(res, 200, {
      success: true,
      message: 'If that email is registered, a magic link has been sent.'
    });

  } catch (error) {
    console.error('Error in send-magic-link:', error);
    return json(res, 500, {
      success: false,
      error: 'Internal server error'
    });
  }
}

