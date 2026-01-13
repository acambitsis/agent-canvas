/**
 * Session utilities for auth routes
 * Provides encrypted session management using jose
 */

import * as jose from 'jose';

const COOKIE_NAME = 'session';
const SESSION_MAX_AGE = 604800; // 7 days in seconds

/**
 * Get the encryption key from environment
 * Must be at least 32 characters
 */
function getEncryptionKey() {
  const password = process.env.WORKOS_COOKIE_PASSWORD;
  if (!password || password.length < 32) {
    throw new Error('WORKOS_COOKIE_PASSWORD must be at least 32 characters');
  }
  // Use first 32 bytes as key for AES-256
  return new TextEncoder().encode(password.slice(0, 32));
}

/**
 * Encrypt session data into a JWT
 */
export async function encryptSession(sessionData) {
  const key = getEncryptionKey();

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
    const key = getEncryptionKey();
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
