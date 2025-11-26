# Magic Link Authentication Specification

A technology-agnostic specification for implementing passwordless magic link authentication using Resend as the email provider.

## Overview

Magic link authentication is a passwordless authentication flow where users receive a time-limited, single-use link via email. Clicking the link verifies ownership of the email address and creates a session.

## Authentication Flow

```
┌─────────┐      1. Enter email      ┌─────────┐
│  User   │ ─────────────────────────▶│  Login  │
│         │                          │  Page   │
└─────────┘                          └────┬────┘
     ▲                                    │
     │                                    │ 2. POST /auth/send-magic-link
     │                                    ▼
     │                            ┌───────────────┐
     │                            │   Server      │
     │                            │ - Rate limit  │
     │                            │ - Gen token   │
     │                            │ - Store token │
     │                            └───────┬───────┘
     │                                    │
     │                                    │ 3. Send email via Resend
     │                                    ▼
     │                            ┌───────────────┐
     │ 4. Receive email           │   Resend      │
     │◀───────────────────────────│   Service     │
     │                            └───────────────┘
     │
     │ 5. Click magic link
     ▼
┌─────────┐      6. GET /auth/verify?token=xxx      ┌─────────┐
│  User   │ ────────────────────────────────────────▶│ Server  │
│         │                                         │ - Verify│
│         │◀────────────────────────────────────────│ - Create│
└─────────┘      7. Set session cookie + redirect   │   sess  │
                                                    └─────────┘
```

## Data Models

### SessionData

Stored in an encrypted HTTP-only cookie.

```typescript
interface SessionData {
  /** Authenticated user's email address */
  email: string;
  /** Session expiration timestamp (ISO 8601 string) */
  expiresAt: string;
}
```

### MagicLinkToken

Stored in the token storage backend.

```typescript
interface MagicLinkToken {
  /** Email address associated with this token */
  email: string;
  /** Token expiration timestamp (ISO 8601 string) */
  expiresAt: string;
  /** Optional redirect URL after successful authentication */
  redirectUrl?: string;
}
```

### RateLimitConfig

Configuration for rate limiting.

```typescript
interface RateLimitConfig {
  /** Maximum number of requests allowed */
  maxRequests: number;
  /** Time window in seconds */
  windowSeconds: number;
}
```

### RateLimitResult

Result of a rate limit check.

```typescript
interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of requests remaining in the current window */
  remaining: number;
  /** When the rate limit window resets (Unix timestamp in seconds) */
  resetAt: number;
}
```

## Storage Abstraction

The storage layer must implement the following interface. Storage can be Redis/KV, PostgreSQL, file-based, or any other backend.

```typescript
interface MagicLinkStorage {
  /**
   * Store a magic link token with automatic expiration
   * @param token - Unique token string (32+ characters, cryptographically random)
   * @param data - Token data including email and expiration
   * @param ttlSeconds - Time-to-live in seconds (should match expiresAt)
   */
  storeMagicLink(token: string, data: MagicLinkToken, ttlSeconds: number): Promise<void>;

  /**
   * Retrieve and DELETE a magic link token (single-use)
   * Must atomically retrieve and delete to prevent replay attacks
   * @param token - The token to verify
   * @returns Token data if valid and not expired, null otherwise
   */
  verifyAndConsumeMagicLink(token: string): Promise<MagicLinkToken | null>;
}

interface RateLimitStorage {
  /**
   * Check and increment rate limit counter
   * Uses sliding window approach
   * @param identifier - Unique identifier (IP address or email)
   * @param config - Rate limit configuration
   * @returns Rate limit result
   */
  checkRateLimit(identifier: string, config: RateLimitConfig): Promise<RateLimitResult>;
}
```

### Example: Redis/KV Implementation

```typescript
// Key patterns
const MAGIC_LINK_KEY_PREFIX = 'magiclink:';

async function storeMagicLink(
  token: string,
  data: MagicLinkToken,
  ttlSeconds: number
): Promise<void> {
  const key = `${MAGIC_LINK_KEY_PREFIX}${token}`;
  await kv.set(key, data, { ex: ttlSeconds });
}

async function verifyAndConsumeMagicLink(token: string): Promise<MagicLinkToken | null> {
  const key = `${MAGIC_LINK_KEY_PREFIX}${token}`;
  const data = await kv.get<MagicLinkToken>(key);

  if (!data) return null;

  // Check expiration
  if (new Date(data.expiresAt) <= new Date()) {
    await kv.del(key);
    return null;
  }

  // Delete after retrieval (single-use)
  await kv.del(key);
  return data;
}
```

### Example: File-based Implementation

```typescript
import { promises as fs } from 'fs';
import path from 'path';

const TOKEN_DIR = '/var/lib/myapp/tokens';

async function storeMagicLink(
  token: string,
  data: MagicLinkToken,
  ttlSeconds: number
): Promise<void> {
  const filePath = path.join(TOKEN_DIR, `${token}.json`);
  await fs.writeFile(filePath, JSON.stringify(data));
  // Note: File-based storage requires a cleanup job for expired tokens
}

async function verifyAndConsumeMagicLink(token: string): Promise<MagicLinkToken | null> {
  const filePath = path.join(TOKEN_DIR, `${token}.json`);

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const data: MagicLinkToken = JSON.parse(content);

    // Delete immediately (single-use)
    await fs.unlink(filePath);

    // Check expiration
    if (new Date(data.expiresAt) <= new Date()) {
      return null;
    }

    return data;
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}
```

### Example: PostgreSQL Implementation

```sql
CREATE TABLE magic_link_tokens (
  token VARCHAR(64) PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  redirect_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_magic_link_expires ON magic_link_tokens(expires_at);
```

```typescript
async function storeMagicLink(
  token: string,
  data: MagicLinkToken,
  ttlSeconds: number
): Promise<void> {
  await db.query(
    `INSERT INTO magic_link_tokens (token, email, expires_at, redirect_url)
     VALUES ($1, $2, $3, $4)`,
    [token, data.email, data.expiresAt, data.redirectUrl]
  );
}

async function verifyAndConsumeMagicLink(token: string): Promise<MagicLinkToken | null> {
  // Atomic delete and return
  const result = await db.query(
    `DELETE FROM magic_link_tokens
     WHERE token = $1 AND expires_at > NOW()
     RETURNING email, expires_at as "expiresAt", redirect_url as "redirectUrl"`,
    [token]
  );

  return result.rows[0] || null;
}
```

## API Endpoints

### POST /auth/send-magic-link

Generates and sends a magic link to the provided email.

**Request Body:**
```json
{
  "email": "user@example.com",
  "redirectUrl": "/dashboard"  // optional
}
```

**Behavior:**
1. Rate limit by IP (10 requests / 15 minutes)
2. Validate email format
3. Rate limit by email (5 requests / 15 minutes)
4. Validate redirectUrl (must be same-origin or relative path)
5. Generate cryptographically secure token (32 characters, use `nanoid` or `crypto.randomBytes`)
6. Store token with 15-minute TTL
7. Construct magic link URL: `{BASE_URL}/auth/verify?token={token}&redirect={redirectUrl}`
8. Send email via Resend
9. Return generic success message (don't reveal if email exists)

**Response (200):**
```json
{
  "success": true,
  "message": "If that email is registered, a magic link has been sent."
}
```

**Error Responses:**
- `400`: Invalid email format
- `429`: Rate limit exceeded (include `Retry-After` header)
- `500`: Server error

### GET /auth/verify

Verifies a magic link token and creates a session.

**Query Parameters:**
- `token` (required): The magic link token
- `redirect` (optional): Fallback redirect URL

**Behavior:**
1. Extract token from query params
2. Call `verifyAndConsumeMagicLink(token)` - atomically verify and delete
3. If invalid/expired, return HTML error page
4. Create session cookie with email and 30-day expiration
5. Redirect to: `tokenData.redirectUrl || queryParam.redirect || '/'`
6. Validate redirect URL before redirecting (prevent open redirect)

**Success:** HTTP 302 redirect with session cookie set

**Error Responses:**
- `400`: Missing token (HTML error page)
- `401`: Invalid/expired token (HTML error page)
- `500`: Server error (HTML error page)

### POST /auth/logout

Destroys the session.

**Behavior:**
1. Destroy/clear session cookie
2. Return success

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### GET /auth/logout

Alternative logout endpoint for direct browser navigation.

**Query Parameters:**
- `redirect` (optional): URL to redirect after logout

**Behavior:**
1. Destroy session cookie
2. Validate redirect URL
3. Redirect to validated URL or '/'

## Session Management

### Session Configuration

| Setting | Value | Description |
|---------|-------|-------------|
| Cookie name | `{app-name}-session` | Customizable per application |
| Max age | 30 days | Session duration |
| HTTP-only | `true` | Prevents XSS access |
| Secure | `true` in production | HTTPS only |
| SameSite | `strict` | CSRF protection |
| Path | `/` | Available site-wide |

### Session Operations

```typescript
interface SessionManager {
  /** Get current session from request */
  getSession(request: Request): Promise<SessionData | null>;

  /** Check if session is valid (exists and not expired) */
  isAuthenticated(request: Request): Promise<boolean>;

  /** Get authenticated email or null */
  getAuthenticatedEmail(request: Request): Promise<string | null>;

  /** Create new session for email */
  createSession(response: Response, email: string): Promise<void>;

  /** Destroy current session */
  destroySession(response: Response): Promise<void>;
}
```

### Session Secret Requirements

- Minimum 32 characters
- Cryptographically random (use `openssl rand -hex 32`)
- Sufficient entropy (not repeated characters)
- Stored as environment variable `SESSION_SECRET`

## Email Service Integration (Resend)

This specification uses **Resend** (https://resend.com) as the required email provider for sending magic links.

### Resend Setup Steps

1. **Create Account**
   - Sign up at https://resend.com
   - Free tier: 100 emails/day, 3,000 emails/month

2. **Domain Verification** (Required for production)
   - Go to https://resend.com/domains
   - Add your domain (e.g., `yourdomain.com`)
   - Add the DNS records Resend provides (SPF, DKIM, DMARC)
   - Wait for verification (usually minutes, can take up to 48 hours)
   - For development, use Resend's test domain: `onboarding@resend.dev`

3. **Create API Key**
   - Go to https://resend.com/api-keys
   - Click "Create API Key"
   - Name it (e.g., "my-app-production")
   - Select permissions: "Sending access" is sufficient
   - Copy the key immediately (shown only once)

### Environment Variables

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `RESEND_API_KEY` | Yes | `re_123abc...` | API key from Resend dashboard |
| `RESEND_FROM_EMAIL` | Yes | `auth@yourdomain.com` | Must be from a verified domain |

**Important:** The `RESEND_FROM_EMAIL` must be an email address from a domain you've verified in Resend. Using an unverified domain will fail.

### SDK Installation

**Node.js / TypeScript:**
```bash
npm install resend
# or
pnpm add resend
```

**Python:**
```bash
pip install resend
```

### SDK Usage

**TypeScript/JavaScript:**
```typescript
import { Resend } from 'resend';

// Initialize client (lazy initialization recommended)
let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

// Send magic link email
async function sendMagicLinkEmail(
  toEmail: string,
  magicLinkUrl: string
): Promise<{ success: boolean; error?: string }> {
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!fromEmail) {
    return { success: false, error: 'RESEND_FROM_EMAIL not configured' };
  }

  try {
    const resend = getResendClient();
    const result = await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: 'Sign in to Your App',
      html: buildEmailHtml(magicLinkUrl),
      text: buildEmailText(magicLinkUrl),
    });

    if (result.error) {
      console.error('Resend error:', result.error);
      return { success: false, error: result.error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to send email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
```

**Python/FastAPI:**
```python
import os
import resend
from typing import Optional

# Initialize on module load or lazily
resend.api_key = os.environ.get("RESEND_API_KEY")

def send_magic_link_email(
    to_email: str,
    magic_link_url: str
) -> dict:
    from_email = os.environ.get("RESEND_FROM_EMAIL")
    if not from_email:
        return {"success": False, "error": "RESEND_FROM_EMAIL not configured"}

    if not resend.api_key:
        return {"success": False, "error": "RESEND_API_KEY not configured"}

    try:
        result = resend.Emails.send({
            "from": from_email,
            "to": to_email,
            "subject": "Sign in to Your App",
            "html": build_email_html(magic_link_url),
            "text": build_email_text(magic_link_url),
        })
        return {"success": True, "id": result["id"]}
    except resend.exceptions.ResendError as e:
        return {"success": False, "error": str(e)}
```

### Error Handling

Common Resend errors to handle:

| Error | Cause | Solution |
|-------|-------|----------|
| `missing_api_key` | No API key provided | Check `RESEND_API_KEY` env var |
| `invalid_api_key` | API key is malformed | Regenerate key in dashboard |
| `validation_error` | Invalid email format | Validate email before sending |
| `not_found` | Domain not verified | Verify domain in Resend dashboard |
| `rate_limit_exceeded` | Too many requests | Implement backoff, check plan limits |

### Email Template

The magic link email should include:

1. **Subject:** "Sign in to {App Name}"
2. **Content:**
   - Clear call-to-action button with magic link
   - Plain text fallback with full URL
   - Expiration notice (15 minutes)
   - Security note about unsolicited emails

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign in to {App Name}</title>
</head>
<body style="font-family: system-ui, sans-serif; background: #f5f5f5; padding: 40px;">
  <table width="600" style="background: #fff; border-radius: 8px; margin: 0 auto;">
    <tr>
      <td style="padding: 40px; text-align: center;">
        <h1 style="color: #1a1a1a;">{App Name}</h1>
        <p style="color: #4a4a4a;">
          Click the button below to sign in. This link expires in <strong>15 minutes</strong>.
        </p>
        <a href="{MAGIC_LINK_URL}"
           style="display: inline-block; padding: 14px 32px; background: #0070f3; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600;">
          Sign In
        </a>
        <p style="color: #6a6a6a; font-size: 14px; margin-top: 20px;">
          Or copy this URL: {MAGIC_LINK_URL}
        </p>
        <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 20px 0;">
        <p style="color: #8a8a8a; font-size: 12px;">
          If you didn't request this email, you can safely ignore it.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
```

## Security Considerations

### Rate Limiting

Apply rate limits at two levels:

1. **By IP address:** 10 requests / 15 minutes
   - Prevents abuse from a single source
   - Use `X-Forwarded-For` or `X-Real-IP` headers behind proxies

2. **By email address:** 5 requests / 15 minutes
   - Prevents email bombing
   - Applied after email validation

**Rate limit headers to include on 429 responses:**
- `Retry-After`: Seconds until limit resets
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Unix timestamp when limit resets

### Token Security

- **Length:** 32+ characters
- **Generation:** Use cryptographically secure random generator (`nanoid`, `crypto.randomBytes`)
- **Single-use:** Delete immediately after successful verification
- **TTL:** 15 minutes automatic expiration
- **Storage:** Never log tokens, use secure storage

### Redirect URL Validation

Prevent open redirect attacks by validating redirect URLs:

```typescript
function validateRedirectUrl(redirectUrl: string | null, baseUrl: string): string | null {
  if (!redirectUrl) return null;

  // Allow relative paths (but not protocol-relative)
  if (redirectUrl.startsWith('/') && !redirectUrl.startsWith('//')) {
    return redirectUrl;
  }

  // For full URLs, verify same origin
  try {
    const url = new URL(redirectUrl, baseUrl);
    const base = new URL(baseUrl);

    if (url.protocol === base.protocol &&
        url.hostname === base.hostname &&
        url.port === base.port) {
      return url.pathname + url.search + url.hash;
    }
  } catch {
    // Invalid URL
  }

  return null;
}
```

### Email Normalization

Always normalize emails before storage and comparison:

```typescript
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
```

### Session Cookie Security

```typescript
const sessionOptions = {
  password: process.env.SESSION_SECRET,  // 32+ chars, high entropy
  cookieName: '{app}-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 30,  // 30 days
    path: '/',
  },
};
```

### Security Event Logging

Log the following events for security monitoring:

| Event Type | Data to Log |
|------------|-------------|
| `magic_link_sent` | IP, email (hashed) |
| `magic_link_verified` | IP, email (hashed) |
| `magic_link_failed` | IP, reason |
| `rate_limit_exceeded` | IP, identifier type, limit |
| `invalid_email_format` | IP |
| `invalid_redirect_url` | IP, attempted URL |
| `logout` | IP, email (hashed) |

## Middleware Pattern

For frameworks that support middleware, intercept protected routes to:

1. Extract session from cookie
2. Verify session not expired
3. Attach user email to request context/headers
4. Let route handlers decide access based on their requirements

```typescript
async function authMiddleware(request: Request): Promise<Request> {
  const session = await getSession(request);

  if (session?.email && session?.expiresAt) {
    if (new Date(session.expiresAt) > new Date()) {
      // Attach email to request for downstream handlers
      request.headers.set('x-user-email', session.email);
    }
  }

  return request;
}
```

## Configuration Summary

| Variable | Required | Description |
|----------|----------|-------------|
| `SESSION_SECRET` | Yes | 32+ char secret for session encryption |
| `RESEND_API_KEY` | Yes | API key from Resend |
| `RESEND_FROM_EMAIL` | Yes | Verified sender email |
| `BASE_URL` | Yes | Application base URL for magic links |

## Implementation Checklist

- [ ] Token storage with TTL support
- [ ] Rate limiting storage
- [ ] Session management (encrypted cookies)
- [ ] Email sending via Resend
- [ ] POST /auth/send-magic-link endpoint
- [ ] GET /auth/verify endpoint
- [ ] POST /auth/logout endpoint
- [ ] GET /auth/logout endpoint (optional)
- [ ] Redirect URL validation
- [ ] Email normalization
- [ ] Rate limiting (IP + email)
- [ ] Security headers (CSP, X-Frame-Options, etc.)
- [ ] Security event logging
- [ ] Error handling with user-friendly pages
- [ ] Middleware for session extraction (optional)

## Framework-Specific Notes

### Python/FastAPI

- Use `itsdangerous` for session signing or `python-jose` for JWT sessions
- Use `redis-py` for Redis storage
- Use `slowapi` for rate limiting
- Install `resend` Python package

### React/Vite

- Login page is a client-side component
- API calls via `fetch` to your backend
- Store redirect URL in `sessionStorage` during login flow
- Handle 401/403 responses by redirecting to login

### Notes for Stateless Backends

If using JWT instead of server-side sessions:
- Store session data in JWT payload
- Sign with strong secret (HS256 minimum)
- Set appropriate expiration
- Consider refresh token pattern for long-lived sessions
