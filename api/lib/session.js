/**
 * Session management using encrypted cookies with Web Crypto API
 * Works in both Edge runtime and Node.js runtime
 */

const COOKIE_NAME = 'agent-canvas-session';
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Get encryption key from SESSION_SECRET
 * Uses Web Crypto API to derive a key suitable for AES-GCM
 */
async function getEncryptionKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET environment variable is not set');
  }

  // Validate minimum length (32 bytes = 32 characters for ASCII)
  if (secret.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters long');
  }

  // Import the secret as a key for encryption
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret.slice(0, 32)); // Use first 32 bytes
  
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt session data
 */
async function encryptSession(data) {
  const key = await getEncryptionKey();
  const encoder = new TextEncoder();
  const dataStr = JSON.stringify(data);
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(dataStr)
  );
  
  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  // Base64 encode for cookie
  // Use TextEncoder/TextDecoder for Edge runtime compatibility
  const binary = Array.from(combined, byte => String.fromCharCode(byte)).join('');
  return btoa ? btoa(binary) : Buffer.from(combined).toString('base64');
}

/**
 * Decrypt session data
 */
async function decryptSession(encryptedData) {
  try {
    const key = await getEncryptionKey();
    const decoder = new TextDecoder();
    
    // Decode from base64
    // Handle both Edge runtime (atob) and Node.js runtime (Buffer)
    let combined;
    if (typeof atob !== 'undefined') {
      combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
    } else {
      combined = new Uint8Array(Buffer.from(encryptedData, 'base64'));
    }
    
    // Extract IV and encrypted data
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );
    
    const dataStr = decoder.decode(decrypted);
    return JSON.parse(dataStr);
  } catch (error) {
    return null;
  }
}

/**
 * Parse cookies from request headers
 */
function parseCookies(headers) {
  const cookies = {};
  const cookieHeader = headers.get ? headers.get('cookie') : headers.cookie;
  
  if (!cookieHeader) {
    return cookies;
  }
  
  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.trim().split('=');
    if (name) {
      cookies[name] = rest.join('=');
    }
  });
  
  return cookies;
}

/**
 * Get current session from request
 * @param {Request|Object} request - Request object (Edge or Node.js)
 * @returns {Promise<Object|null>} Session data or null
 */
export async function getSession(request) {
  const headers = request.headers || {};
  const cookies = parseCookies(headers);
  const cookieValue = cookies[COOKIE_NAME];
  
  if (!cookieValue) {
    return null;
  }
  
  const sessionData = await decryptSession(cookieValue);
  if (!sessionData) {
    return null;
  }
  
  // Check expiration
  if (new Date(sessionData.expiresAt) <= new Date()) {
    return null;
  }
  
  return sessionData;
}

/**
 * Check if request is authenticated
 * @param {Request|Object} request - Request object
 * @returns {Promise<boolean>} True if authenticated
 */
export async function isAuthenticated(request) {
  const session = await getSession(request);
  return session !== null;
}

/**
 * Get authenticated email from session
 * @param {Request|Object} request - Request object
 * @returns {Promise<string|null>} Email or null
 */
export async function getAuthenticatedEmail(request) {
  const session = await getSession(request);
  return session?.email || null;
}

/**
 * Create session cookie
 * @param {Response|Object} response - Response object
 * @param {string} email - User email
 */
export async function createSession(response, email) {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
  const sessionData = { email, expiresAt };
  
  const encrypted = await encryptSession(sessionData);
  const isProduction = process.env.NODE_ENV === 'production';
  
  const cookieOptions = [
    `${COOKIE_NAME}=${encrypted}`,
    `Max-Age=${SESSION_DURATION_MS / 1000}`,
    'HttpOnly',
    'SameSite=Strict',
    `Path=/`
  ];
  
  if (isProduction) {
    cookieOptions.push('Secure');
  }
  
  const cookieHeader = cookieOptions.join('; ');
  
  if (response.headers) {
    // Edge runtime
    response.headers.set('Set-Cookie', cookieHeader);
  } else {
    // Node.js runtime
    response.setHeader('Set-Cookie', cookieHeader);
  }
}

/**
 * Destroy session cookie
 * @param {Response|Object} response - Response object
 */
export function destroySession(response) {
  const cookieOptions = [
    `${COOKIE_NAME}=`,
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Strict',
    'Path=/'
  ];
  
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    cookieOptions.push('Secure');
  }
  
  const cookieHeader = cookieOptions.join('; ');
  
  if (response.headers) {
    // Edge runtime
    response.headers.set('Set-Cookie', cookieHeader);
  } else {
    // Node.js runtime
    response.setHeader('Set-Cookie', cookieHeader);
  }
}

