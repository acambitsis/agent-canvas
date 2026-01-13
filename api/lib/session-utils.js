/**
 * Session utilities for auth routes
 * Provides encrypted session management using jose
 */

import * as jose from 'jose';

const COOKIE_NAME = 'session';
const SESSION_MAX_AGE = 604800; // 7 days in seconds

// Cache the derived key to avoid re-deriving on every request
let cachedKey = null;
let cachedPassword = null;

/**
 * Get the encryption key from environment using HKDF
 * Properly derives a 256-bit key regardless of password encoding
 */
async function getEncryptionKey() {
  const password = process.env.WORKOS_COOKIE_PASSWORD;
  if (!password || password.length < 32) {
    throw new Error('WORKOS_COOKIE_PASSWORD must be at least 32 characters');
  }

  // Return cached key if password hasn't changed
  if (cachedKey && cachedPassword === password) {
    return cachedKey;
  }

  // Import password as raw key material for HKDF
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'HKDF',
    false,
    ['deriveKey']
  );

  // Derive a proper 256-bit key using HKDF-SHA256
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode('agentcanvas-session-v1'),
      info: new TextEncoder().encode('encryption'),
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  // Export as raw bytes for jose
  const rawKey = await crypto.subtle.exportKey('raw', derivedKey);
  cachedKey = new Uint8Array(rawKey);
  cachedPassword = password;

  return cachedKey;
}

/**
 * Encrypt session data into a JWT
 */
export async function encryptSession(sessionData) {
  const key = await getEncryptionKey();

  const jwt = await new jose.EncryptJWT(sessionData)
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .encrypt(key);

  return jwt;
}

/**
 * Decrypt session JWT back to data
 */
export async function decryptSession(token) {
  if (!token) return null;

  try {
    const key = await getEncryptionKey();
    const { payload } = await jose.jwtDecrypt(token, key);
    return payload;
  } catch (error) {
    // Token invalid, expired, or tampered
    console.error('Session decryption failed:', error.message);
    return null;
  }
}

/**
 * Parse session from request cookie and decrypt
 */
export async function parseSession(request) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/session=([^;]+)/);
  if (!match) return null;

  return decryptSession(match[1]);
}

/**
 * Create Set-Cookie header value for session
 */
export function createSessionCookie(token) {
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE}`;
}

/**
 * Create Set-Cookie header value to clear session
 */
export function clearSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

/**
 * JSON response helper
 */
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
