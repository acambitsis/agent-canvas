/**
 * Authentication utility functions
 */

/**
 * Normalize email address (lowercase and trim)
 * @param {string} email - Email address
 * @returns {string} Normalized email
 */
export function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

/**
 * Validate email format
 * @param {string} email - Email address
 * @returns {boolean} True if valid
 */
export function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  const normalized = normalizeEmail(email);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(normalized);
}

/**
 * Check if email is in allowlist
 * @param {string} email - Email address
 * @returns {boolean} True if allowed
 */
export function checkEmailAllowlist(email) {
  const allowedEmails = process.env.ALLOWED_EMAILS;
  if (!allowedEmails) {
    return false; // No allowlist configured means no access
  }
  
  const normalized = normalizeEmail(email);
  const allowedList = allowedEmails.split(',').map(e => normalizeEmail(e.trim()));
  
  return allowedList.includes(normalized);
}

/**
 * Validate redirect URL to prevent open redirect attacks
 * @param {string|null|undefined} redirectUrl - Redirect URL
 * @param {string} baseUrl - Base URL of the application
 * @returns {string|null} Validated redirect URL or null
 */
export function validateRedirectUrl(redirectUrl, baseUrl) {
  if (!redirectUrl) {
    return null;
  }

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

/**
 * Get client IP address from request
 * Handles X-Forwarded-For and X-Real-IP headers
 * @param {Request|Object} request - Request object
 * @returns {string} IP address
 */
export function getClientIP(request) {
  const headers = request.headers || {};
  
  // Helper to get header value
  const getHeader = (name) => {
    if (headers.get) {
      // Edge runtime
      return headers.get(name) || headers.get(name.toLowerCase());
    }
    // Node.js runtime
    return headers[name] || headers[name.toLowerCase()];
  };
  
  // Check X-Forwarded-For (first IP is the original client)
  const forwardedFor = getHeader('x-forwarded-for');
  if (forwardedFor) {
    const ips = forwardedFor.split(',').map(ip => ip.trim());
    if (ips.length > 0) {
      return ips[0];
    }
  }
  
  // Check X-Real-IP
  const realIP = getHeader('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  // Fallback (for local development)
  return '127.0.0.1';
}

/**
 * Get query parameter from request
 * Works with both Node.js and Edge runtime request objects
 * @param {Request|Object} req - Request object
 * @param {string} key - Query parameter key
 * @returns {string|null} Query parameter value or null
 */
export function getQueryParam(req, key) {
  // Check if query params are already parsed (Node.js runtime)
  if (req.query && req.query[key] !== undefined) {
    return req.query[key];
  }
  
  // Parse from URL (works for both runtimes)
  if (req.url) {
    try {
      // For Edge runtime, req.url is a full URL
      // For Node.js runtime, we may need to construct the full URL
      const url = req.url.startsWith('http') 
        ? new URL(req.url)
        : new URL(req.url, `http://${req.headers?.host || 'localhost'}`);
      return url.searchParams.get(key);
    } catch {
      // Ignore parse errors
    }
  }
  
  return null;
}

